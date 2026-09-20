import { describe, expect, it } from "vitest";
import { rankProductPhoto } from "../src/lib/vapePhotoMatch";

const products = [
  { id: "1", name: "ELFBAR ELFA POD Apple Peach 20mg", supplier_article_no: "ELF10012", ean: "4251234567890" },
  { id: "2", name: "ELFBAR ELFA POD Blueberry 20mg", supplier_article_no: "ELF10013", ean: "4251234567891" },
  { id: "3", name: "OXVA NEXLIM POD KIT Black", supplier_article_no: "OXV3001", ean: null },
];

describe("photo lookup uses only catalogue entries", () => {
  it("identifies an exact EAN", () => {
    const list = rankProductPhoto(products,"",["4251234567891"]);
    expect(list[0]).toMatchObject({item:{id:"2"},score:100});
  });
  it("identifies an exact printed supplier article number", () => {
    const list = rankProductPhoto(products,"Artikel ELF10012",[]);
    expect(list[0]).toMatchObject({item:{id:"1"},score:95});
  });
  it("requires confirmation even when every package word matches", () => {
    const list = rankProductPhoto(products,"ELFBAR ELFA POD Apple Peach 20mg",[]);
    expect(list[0].item.id).toBe("1");
    expect(list[0].score).toBeLessThan(95);
  });
  it("never invents an article absent from the CRM", () => {
    expect(rankProductPhoto(products,"something completely different",[])).toEqual([]);
  });
});
