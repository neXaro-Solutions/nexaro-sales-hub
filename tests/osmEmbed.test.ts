import { describe, it, expect } from "vitest";
import { osmEmbed, osmLocation } from "../src/lib/osmEmbed";

describe("embedded location preview", () => {
  it("uses OSM embed for the searched geocoded center", () => {
    const url=new URL(osmEmbed({lat:52.058,lng:13.705},2));
    expect(url.origin).toBe("https://www.openstreetmap.org");
    expect(url.pathname).toBe("/export/embed.html");
    expect(url.searchParams.get("marker")).toBe("52.058,13.705");
    expect(url.searchParams.get("bbox")?.split(",")).toHaveLength(4);
  });
  it("shows selected lead on the map instead of the city center", () => {
    const url=new URL(osmEmbed({lat:52,lng:13},5,{lat:52.013,lng:13.019}));
    expect(url.searchParams.get("marker")).toBe("52.013,13.019");
  });
  it("rejects invalid coordinates and limits map radius", () => {
    expect(()=>osmEmbed({lat:100,lng:13},2)).toThrow();
    expect(()=>osmEmbed({lat:52,lng:13},31)).toThrow();
    expect(()=>osmLocation(NaN,13)).toThrow();
  });
});
