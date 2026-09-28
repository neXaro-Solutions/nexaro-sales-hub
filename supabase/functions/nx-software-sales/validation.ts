export const stages=['new','contacted','demo','proposal','pilot','won','lost','archived'];
export function validateLead(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Bitte die Angaben prüfen.');
 const p=input as Record<string,unknown>;
 const text=(k:string,n:number,required=false)=>{if(p[k]!==undefined&&typeof p[k]!=='string')throw Error('Ungültige Angabe: '+k);const s=String(p[k]??'').trim();if(s.length>n||(required&&!s))throw Error('Bitte das Feld '+k+' prüfen.');return s};
 const email=text('email',254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Bitte eine gültige E-Mail-Adresse eingeben.');
 const kind=text('request_kind',20)||'consultation';if(!['consultation','demo','pilot'].includes(kind))throw Error('Bitte ein Anliegen auswählen.');
 return {company:text('company',200,true),contact:text('contact',160,true),email,phone:text('phone',40),city:text('city',120),industry:text('industry',100),users_count:text('users_count',40),request_kind:kind,message:text('message',3000)};
}
