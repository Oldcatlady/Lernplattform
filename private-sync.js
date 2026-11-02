/* DOKU: Verbindet IndexedDB-Warteschlange und Firestore-Lernstände. Änderungen werden lokal gesammelt und in Transaktionen übertragen; Geräte-ID plus Sequenznummer dienen der Wiederholungserkennung. */
import {doc,collection,query,limit,getDocs,runTransaction,Timestamp} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
import {requireOwner} from './private-auth.js';
import {readState,updateState} from './private-store.js';
import {shardKey,addDelta,answerDelta,overlay,initialState,enqueue,beginBatch,acknowledge} from './private-sync-core.js';
const timers=new Map(),pendingLoads=new Map(),syncTasks=new Map();
let active;
/* DOKU: Lokaler Schlüssel aus Projekt-ID und Konto-ID verhindert, dass unterschiedliche Projekte/Konten denselben Zustandsschlüssel verwenden. */
const key=uid=>firebaseConfig.projectId+':'+uid;
function fresh(){return initialState(crypto.randomUUID());}
// Automatischer Abgleich ohne eingeblendeten Balken über den Quiz-Buttons.
function status(text,error=false){
 if(error)console.warn(text);
}
/* DOKU: Lädt den kontogebundenen Zustand oder legt ihn mit zufälliger Geräte-ID erstmals lokal an. */
async function state(uid){requireOwner(uid);return (await readState(key(uid)))||await updateState(key(uid),s=>s||fresh());}
/* DOKU: Wandelt Firestore-Zeitstempel für IndexedDB in Millisekunden um; vorhandene neuere Millisekundenwerte bleiben erhalten. */
function toRaw(row){const next={...row};for(const [field,ms]of [['lastPlayed','lastPlayedMs'],['lastViewed','lastViewedMs']]){
 if(next[field]?.toMillis)next[ms]=Math.max(next[ms]||0,next[field].toMillis());delete next[field];}return next;}
/* DOKU: Stellt aus Millisekunden zusätzlich Firebase-Timestamps für bestehende Seitenfunktionen her. */
function toDisplay(map){return new Map([...map].map(([id,row])=>[id,{...row,
 ...(row.lastPlayedMs?{lastPlayed:Timestamp.fromMillis(row.lastPlayedMs)}:{}),
 ...(row.lastViewedMs?{lastViewed:Timestamp.fromMillis(row.lastViewedMs)}:{})}]));}
/* DOKU: Startet je UID höchstens ein Minutenintervall während der geöffneten Seite. Hintergrundtabs können vom Browser verzögert werden; dies ist kein serverseitiger Zeitplan. */
function watch(db,uid){active={db,uid};if(timers.has(uid))return;timers.set(uid,setInterval(()=>{flush(db,uid).catch(error=>{console.error(error);status('Noch nicht synchronisiert. Deine Antworten sind auf diesem Gerät gesichert.',true);});},60_000));}
/* DOKU: Sichert zuerst die Änderung in IndexedDB und aktiviert den Abgleich. Bei abgelaufenem Intervall wird Versand angestoßen. Die Rückgabe ist der angezeigte Lernstand, keine Garantie einer bereits bestätigten Cloud-Speicherung. */
export async function queueAnswer(db,uid,question,answer){
 requireOwner(uid);const delta=answerDelta(question,answer);
 await updateState(key(uid),s=>enqueue(s||fresh(),question.id,delta));
 watch(db,uid);status('Antwort gesichert · Cloud-Abgleich spätestens beim nächsten aktiven Minutenintervall.');
 // Bei Wiederaufnahme nach langer Pause zeitnah senden, aber nicht auf jede Antwort lesen.
 const s=await state(uid);if(Date.now()-s.lastSyncAt>=60_000)void flush(db,uid).catch(error=>{console.error(error);status('Cloud-Abgleich ausstehend; Antwort auf diesem Gerät gesichert.',true);});
 return (await loadLearningState(db,uid)).get(question.id);
}
/* DOKU: Bündelt gleichzeitig laufende Versandaufrufe je UID in einem Promise; Fehler werden an den Aufrufer weitergegeben. */
export async function flush(db,uid,force=false){
 requireOwner(uid);if(syncTasks.has(uid))return syncTasks.get(uid);
 const task=flushOnce(db,uid,force);syncTasks.set(uid,task);
 try{return await task;}finally{syncTasks.delete(uid);}
}
/* DOKU: Reserviert einen lokalen Batch, gruppiert ihn nach Shards und liest in einer Firestore-Transaktion Quittung und Zielstände. Bereits quittierte Sequenzen werden nicht nochmals addiert. Erst nach erfolgreicher Transaktion wird lokal bestätigt. */
async function flushOnce(db,uid,force=false){
 requireOwner(uid);let batch;
 await updateState(key(uid),s=>{const next=beginBatch(s||fresh(),Date.now(),force);batch=next.batch;return next.state;});
 if(!batch)return;
 status('Lernstand wird mit deinem privaten Projekt synchronisiert …');
 const groups=new Map();for(const [id,delta]of Object.entries(batch.deltas)){const shard=shardKey(id);if(!groups.has(shard))groups.set(shard,[]);groups.get(shard).push([id,delta]);}
 const confirmed=await runTransaction(db,async tx=>{
  const receipt=doc(db,'users',uid,'syncDevices',batch.deviceId);
  const receiptSnap=await tx.get(receipt);
  const shardRows=await Promise.all([...groups].map(async([shard,deltas])=>{const ref=doc(db,'users',uid,'learningState',shard);const snapshot=await tx.get(ref);return {ref,deltas,entries:snapshot.exists()?snapshot.data().entries||{}:{}};}));
/* DOKU: Die serverseitige Gerätequittung verhindert erneutes Addieren desselben Batches, falls der Browser nach erfolgreichem Schreiben vor der lokalen Bestätigung unterbrochen wurde. */
  const already=(receiptSnap.exists()?receiptSnap.data().lastSeq||0:0)>=batch.seq;
  const result=[];
  for(const row of shardRows){const entries=Object.fromEntries(Object.entries(row.entries).map(([id,value])=>[id,toRaw(value)]));
   if(!already){for(const [id,delta]of row.deltas)entries[id]=addDelta(entries[id],delta);
    if(new TextEncoder().encode(JSON.stringify(entries)).length>850000)throw new Error('Lernstandpaket zu groß. Bitte vor weiteren Antworten aufteilen.');
    tx.set(row.ref,{entries},{merge:true});}
   result.push(...Object.entries(entries));
  }
  if(!already)tx.set(receipt,{lastSeq:batch.seq,updatedAt:Timestamp.now()});
  return result;
 });
 await updateState(key(uid),s=>acknowledge(s,batch,confirmed,Date.now()));
 const after=await state(uid);status(Object.keys(after.pending).length?'Cloud-Abgleich erfolgreich · Weitere Antworten warten auf den nächsten Abgleich.':'Lernstand mit der Cloud synchronisiert.');
}
/* DOKU: Liest höchstens 17 Dokumente zur Strukturprüfung (zulässig sind 16). Cloud-Lesen wird zeitlich begrenzt; lokale Werte werden mit Maxima zusammengeführt und anschließend ausstehende Änderungen eingeblendet. Der Parameter refresh wird im aktuellen Körper nicht ausgewertet. */
export async function loadLearningState(db,uid,{refresh=false}={}){
 requireOwner(uid);watch(db,uid);let s=await state(uid);
 if(!s.cloudAt||Date.now()-(s.cloudReadAt||0)>=60_000){
  if(!pendingLoads.has(uid))pendingLoads.set(uid,(async()=>{
   const rows=await getDocs(query(collection(db,'users',uid,'learningState'),limit(17)));
   if(rows.size>16)throw new Error('Ungültige private Lernstandstruktur.');
   const cloud=rows.docs.flatMap(d=>Object.entries(d.data().entries||{}).map(([id,value])=>[id,toRaw(value)]));
   await updateState(key(uid),before=>{
    const merged=new Map(before.cloud||[]);
    for(const [id,value]of cloud){const previous=merged.get(id)||{},next={...previous,...value};
     for(const field of ['timesPlayed','timesCorrect','timesWrong','timesViewed','lastPlayedMs','lastViewedMs'])next[field]=Math.max(previous[field]||0,value[field]||0);
     merged.set(id,next);
    }
    return {...before,cloud:[...merged],cloudAt:Date.now(),cloudReadAt:Date.now()};
   });
  })());
  try{await pendingLoads.get(uid);}finally{pendingLoads.delete(uid);}s=await state(uid);
 }
 return toDisplay(overlay(s.cloud,s.pending,s.inflight));
}
/* DOKU: Erzwingt den Versand und ruft danach den Lernstandlader auf. Dessen Minutenbedingung bleibt trotz refresh:true wirksam. */
export async function manualSync(db,uid){await flush(db,uid,true);const result=await loadLearningState(db,uid,{refresh:true});status('Cloud-Abgleich abgeschlossen. Du kannst auf einem anderen Gerät weiterlernen.');return result;}
/* DOKU: Entfernt die registrierten Intervalle, löscht aber keine lokalen Daten und bricht bereits laufende Promises nicht ab. */
export function stopSync(){for(const timer of timers.values())clearInterval(timer);timers.clear();active=null;}
export {state as getPrivateState,key as privateStateKey};
