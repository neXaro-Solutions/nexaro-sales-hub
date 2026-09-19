import { mkdir, copyFile, readdir, writeFile } from "node:fs/promises";
const target = new URL("../public/ocr/", import.meta.url);
for (const dir of ["core", "lang"])
  await mkdir(new URL(dir + "/", target), { recursive: true });
await copyFile(
  new URL("../node_modules/tesseract.js/dist/worker.min.js", import.meta.url),
  new URL("worker.min.js", target),
);
const core = new URL("../node_modules/tesseract.js-core/", import.meta.url);
// Includes SIMD / relaxed SIMD / non-SIMD builds; Tesseract chooses per device.
for (const name of await readdir(core))
  if (name.endsWith(".wasm.js"))
    await copyFile(new URL(name, core), new URL("core/" + name, target));
await copyFile(
  new URL(
    "../node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz",
    import.meta.url,
  ),
  new URL("lang/deu.traineddata.gz", target),
);
await copyFile(
  new URL("../node_modules/tesseract.js/LICENSE.md", import.meta.url),
  new URL("LICENSE-tesseract.txt", target),
);
await copyFile(
  new URL("../node_modules/tesseract.js-core/LICENSE", import.meta.url),
  new URL("LICENSE-core.txt", target),
);
await writeFile(
  new URL("NOTICE.txt", target),
  "Tesseract.js 7.0.0 and tesseract.js-core, Apache-2.0. German model: @tesseract.js-data/deu 1.0.0 / Tesseract tessdata, Apache-2.0. Assets loaded only for local OCR. Source: https://github.com/naptha/tesseract.js and https://github.com/tesseract-ocr/tessdata\n",
);
