/** OSM's own embed, with a geographically bounded view and optional exact marker. */
export function osmEmbed(center:{lat:number;lng:number}, radiusKm:number, marker?:{lat:number;lng:number}):string {
  if(!Number.isFinite(center.lat)||!Number.isFinite(center.lng)||Math.abs(center.lat)>85||
    Math.abs(center.lng)>180||!Number.isFinite(radiusKm)||radiusKm<=0||radiusKm>30)
    throw Error("Ungültige Kartenkoordinaten.");
  const focus=marker&&Number.isFinite(marker.lat)&&Number.isFinite(marker.lng)
    ?marker:center;
  const spanKm=marker?Math.min(1,Math.max(0.4,radiusKm/5)):Math.max(.6,radiusKm*1.25);
  const latDelta=spanKm/111.32;
  const lngDelta=spanKm/(111.32*Math.max(.2,Math.cos(focus.lat*Math.PI/180)));
  const params=new URLSearchParams({
    bbox:[focus.lng-lngDelta,focus.lat-latDelta,focus.lng+lngDelta,focus.lat+latDelta].join(","),
    layer:"mapnik",
    marker:focus.lat+","+focus.lng,
  });
  return "https://www.openstreetmap.org/export/embed.html?"+params.toString();
}
export function osmLocation(lat:number,lng:number):string{
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)
    throw Error("Ungültige Kartenkoordinaten.");
  return "https://www.openstreetmap.org/?mlat="+lat+"&mlon="+lng+"#map=17/"+lat+"/"+lng;
}
