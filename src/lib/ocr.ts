import type { Worker } from "tesseract.js";
export async function recognizeStatement(
  file: File,
  signal: AbortSignal,
  progress: (value: number) => void,
  mode: "statement" | "general" = "general",
) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error(
      "Bitte JPG, PNG oder WebP wählen. HEIC zuvor als JPG exportieren.",
    );
  if (file.size > 15_000_000)
    throw Error("Das Foto darf höchstens 15 MB groß sein.");
  const bitmap = await createImageBitmap(file);
  let canvas: HTMLCanvasElement;
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw Error("Bitte ein Foto mit höchstens 40 Megapixeln verwenden.");
    // Keep small digits and percentage signs in high-resolution A4 statements legible.
    const scale = Math.min(1, 3600 / Math.max(bitmap.width, bitmap.height));
    canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw Error("Bildverarbeitung ist auf diesem Gerät nicht verfügbar.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  } finally {
    bitmap.close();
  }
  let worker: Worker | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void = () => {};
  const abortPromise = new Promise<never>((_, reject) => {
    abort = () => {
      stopped = true;
      void worker?.terminate();
      reject(Error("Texterkennung abgebrochen."));
    };
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => {
      stopped = true;
      void worker?.terminate();
      reject(
        Error(
          "Texterkennung dauert zu lange. Bitte einen kleineren, scharfen Bildausschnitt versuchen.",
        ),
      );
    }, 120000);
  });
  try {
    if (signal.aborted) throw Error("Texterkennung abgebrochen.");
    const job = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const base = new URL(import.meta.env.BASE_URL + "ocr/", location.href)
        .href;
      worker = await createWorker("deu", 1, {
        workerPath: base + "worker.min.js",
        corePath: base + "core",
        langPath: base + "lang",
        workerBlobURL: false,
        logger: (m) =>
          progress(
            m.status === "recognizing text" ? Math.round(m.progress * 100) : 0,
          ),
      });
      if (stopped) {
        await worker.terminate();
        throw Error("Abgebrochen.");
      }
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
      });
      const { data } = await worker.recognize(canvas);
      let text=data.text;
      if(mode==="statement"&&!stopped){
        // The general page layout OCR commonly reads the debit card share but
        // drops the adjacent small fee percentage in multi-column statements.
        // A second, enlarged pass of the central fee-table region improves
        // character separation without introducing any guessed numbers.
        const detail=document.createElement("canvas");
        try{
          const top=Math.round(canvas.height*.46);
          const height=Math.round(canvas.height*.43);
          detail.width=Math.min(5200,canvas.width*2);
          detail.height=Math.min(3600,height*2);
          const ctx=detail.getContext("2d");
          if(ctx){
            ctx.fillStyle="white";ctx.fillRect(0,0,detail.width,detail.height);
            ctx.imageSmoothingEnabled=true;
            ctx.drawImage(canvas,0,top,canvas.width,height,0,0,detail.width,detail.height);
            await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,preserve_interword_spaces:"1"});
            const region=await worker.recognize(detail);
            if(!stopped&&region.data.text.trim()&&region.data.text.trim()!==data.text.trim())
              text+="\n"+region.data.text;
          }
        }finally{detail.width=0;detail.height=0;}
      }
      return { text, confidence: data.confidence };
    })();
    return await Promise.race([job, abortPromise]);
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener("abort", abort);
    stopped = true;
    await worker?.terminate();
    canvas.width = 0;
    canvas.height = 0;
  }
}
