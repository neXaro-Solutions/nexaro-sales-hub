import { test,expect } from "@playwright/test";
test("Hunter shows loading, results, empty search and actionable failure",async({page})=>{
 await page.route("**/functions/v1/nx-hunter-geocode",r=>r.fulfill({json:{lat:52.11667,lng:13.7,label:"15757 Halbe · Ortszentrum"}}));
 let mode="success";
 await page.route("**/functions/v1/nx-hunter-search",async r=>{
  if(mode==="error")return r.fulfill({status:503,json:{error:"SEARCH_UNAVAILABLE"}});
  return r.fulfill({json:{items:mode==="empty"?[]:[{id:"test-cafe",name:"Café Suchtest",street:"Hauptstraße 4",zip:"15757",city:"Halbe",phone:"",website:"",email:"",lat:52.11,lng:13.7,category:"catering"}]}});
 });
 await page.goto("/?demo=1");
 const menu=page.getByRole("button",{name:"Menü öffnen",exact:true});if(await menu.isVisible())await menu.click();
 await page.locator("nav").getByRole("button",{name:"Außendienst · HUNTER",exact:true}).click();
 await page.getByRole("tab",{name:/Geschäfte finden/}).click();
 await page.getByLabel("Umkreis").selectOption("2");
 await page.getByRole("button",{name:"Geschäfte suchen",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Recherchetreffer (1)"})).toBeVisible();
 await expect(page.getByText("Café Suchtest",{exact:true})).toBeVisible();
 await expect(page.getByText("Suchgebiet: 15757 Halbe · Ortszentrum · 2 km")).toBeVisible();
 mode="empty";await page.getByLabel("Umkreis").selectOption("5");
 await page.getByRole("button",{name:"Geschäfte suchen",exact:true}).click();
 await expect(page.getByText(/Keine passenden Geschäfte im gewählten Suchgebiet/)).toBeVisible();
 mode="error";await page.getByLabel("Umkreis").selectOption("10");
 await page.getByRole("button",{name:"Geschäfte suchen",exact:true}).click();
 await expect(page.getByRole("alert")).toContainText("Geschäftssuche ist momentan nicht erreichbar");
 await expect(page.getByText(/Starte eine Suche/)).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Geschäfte suchen",exact:true})).toBeEnabled();
});
