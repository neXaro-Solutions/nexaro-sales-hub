type TransactionSource = "sync" | "user";
type Listener = (value:number, source:TransactionSource)=>void;

let monthlyTransactions=0;
const listeners=new Set<Listener>();

export function getMonthlyTransactions(){
  return monthlyTransactions;
}

export function setMonthlyTransactions(value:number, source:TransactionSource="sync"){
  const next=Number.isFinite(value)?Math.max(0,Math.round(value)):0;
  monthlyTransactions=next;
  for(const listener of listeners)listener(next,source);
}

export function subscribeMonthlyTransactions(listener:Listener){
  listeners.add(listener);
  listener(monthlyTransactions,"sync");
  return ()=>listeners.delete(listener);
}
