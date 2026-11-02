/* DOKU: Lokale Persistenz in IndexedDB statt ausschließlich im Arbeitsspeicher. Inhaltspakete und Synchronisationszustand teilen sich den Object Store state, getrennt durch ihre Schlüssel. */
// Dauerhafte Sicherung nicht synchronisierter Antworten. Cloud bleibt geräteübergreifend.
let opening;
/* DOKU: Öffnet die Datenbank einmal pro Modullaufzeit. Beim ersten Anlegen entsteht der Object Store; weitere Aufrufer teilen sich dasselbe Promise. */
function database(){
 if(!opening)opening=new Promise((resolve,reject)=>{
  const request=indexedDB.open('fiae-private-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('state');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });return opening;
}
/* DOKU: Liest einen Schlüssel und schreibt transform(alterWert) innerhalb einer readwrite-Transaktion zurück. Das Promise wird erst nach erfolgreichem Transaktionsabschluss erfüllt. transform muss synchron einen speicherbaren Wert liefern. */
export async function updateState(key,transform){
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');let result;
  const request=store.get(key);
  request.onsuccess=()=>{try{result=transform(request.result);store.put(result,key);}catch(error){tx.abort();reject(error);}};
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Antwort konnte nicht gesichert werden.'));
 });
}
/* DOKU: Liefert den gespeicherten Wert zu key bzw. undefined. Verändert den Inhalt nicht und meldet Lesefehler über das zurückgegebene Promise. */
export async function readState(key){
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('state'),r=tx.objectStore('state').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
