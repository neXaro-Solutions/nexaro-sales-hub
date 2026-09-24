import {distance} from "./calculations";
export type HunterRoutePoint={id:string;lat:number|null;lng:number|null};
const hasCoordinates=(point:HunterRoutePoint):point is HunterRoutePoint&{lat:number;lng:number}=>point.lat!==null&&point.lng!==null&&Number.isFinite(point.lat)&&Number.isFinite(point.lng);
export function hunterRouteLength<T extends HunterRoutePoint>(points:T[],origin?:{lat:number;lng:number}):number{
 let total=0;
 let last=origin;
 for(const point of points){
  if(!hasCoordinates(point))continue;
  if(last)total+=distance(last,point);
  last=point;
 }
 return total;
}
/** Open-ended visit sequence: nearest-neighbour seed followed by bounded 2-opt. Straight-line approximation, not road travel time. */
export function optimizeHunterRoute<T extends HunterRoutePoint>(points:T[],origin?:{lat:number;lng:number}):T[]{
 const valid=points.filter(hasCoordinates);
 const missing=points.filter(p=>!hasCoordinates(p));
 if(!valid.length)return [...missing];
 const sequence:T[]=[];
 let last=origin||valid[0];
 const remaining=[...valid];
 while(remaining.length){
  let nearest=0;
  for(let i=1;i<remaining.length;i++){
   if(distance(last,remaining[i])<distance(last,remaining[nearest]))nearest=i;
  }
  const [next]=remaining.splice(nearest,1);
  sequence.push(next);
  last=next;
 }
 // Stop before the combinatorial cost becomes unsuitable on mobile.
 for(let pass=0;pass<4;pass++){
  let improved=false;
  for(let i=origin?0:1;i<sequence.length-1;i++){
   for(let j=i+1;j<sequence.length;j++){
    const before=hunterRouteLength(sequence,origin);
    const candidate=[...sequence.slice(0,i),...sequence.slice(i,j+1).reverse(),...sequence.slice(j+1)];
    if(hunterRouteLength(candidate,origin)+0.00001<before){
     sequence.splice(0,sequence.length,...candidate);
     improved=true;
    }
   }
  }
  if(!improved)break;
 }
 return [...sequence,...missing];
}
