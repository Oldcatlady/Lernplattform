/* DOKU: Reine Zustandsberechnung für private-sync.js. pending sammelt neue Änderungen, inflight hält einen bereits begonnenen Versand, cloud enthält bestätigte Zählerstände. */
/* DOKU: Aktuelle Lernstände verteilen sich auf 16 Dokumente; MIN_SYNC_MS begrenzt den regulären Versand auf Minutenabstände. */
export const SHARD_COUNT = 16;
export const MIN_SYNC_MS = 60_000;
/* DOKU: Stabiler Hash der Fragen-ID auf s00 bis s15. Derselbe Schlüssel führt auf allen Geräten zum selben Lernstanddokument. */
export function shardKey(id) {
 let h=2166136261;
 for(const c of id){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
 return 's'+((h>>>0)%SHARD_COUNT).toString().padStart(2,'0');
}
const safe=n=>Number.isSafeInteger(n)&&n>=0?n:0;
/* DOKU: Addiert nichtnegative sichere Ganzzahlen der Antwortzähler und übernimmt den jeweils jüngsten Zeitstempel. Pfad und Quiztyp werden bei vorhandener Änderung ergänzt. */
export function addDelta(old={},delta={}) {
 const next={...old};
 for(const key of ['timesPlayed','timesCorrect','timesWrong','timesViewed'])next[key]=safe(old[key])+safe(delta[key]);
 for(const key of ['lastPlayedMs','lastViewedMs'])next[key]=Math.max(safe(old[key]),safe(delta[key]));
 if(delta.questionPath)next.questionPath=delta.questionPath;
 if(delta.quizType)next.quizType=delta.quizType;
 return next;
}
/* DOKU: Erzeugt aus Frage und Antwort eine Zähleränderung. viewed zählt nur eine Ansicht; sonst werden gespielt und genau eines von richtig/falsch erhöht. Zeiten werden als Millisekunden gespeichert. */
export function answerDelta(question,{isCorrect,viewed=false,type},now=Date.now()) {
 if(!question?.id||!question.path)throw new Error('Fragenreferenz fehlt.');
 return viewed?{timesViewed:1,lastViewedMs:now,questionPath:question.path,quizType:type}:
 {timesPlayed:1,timesCorrect:isCorrect?1:0,timesWrong:isCorrect?0:1,lastPlayedMs:now,questionPath:question.path,quizType:type};
}
/* DOKU: Erzeugt eine Map aus bestätigten Cloud-Werten plus inflight und pending. So zeigt die Oberfläche auch noch nicht bestätigte lokale Antworten. */
export function overlay(cloud,pending,inflight) {
 const result=new Map(cloud||[]);
 for(const deltas of [inflight?.deltas,pending])for(const [id,delta]of Object.entries(deltas||{}))result.set(id,addDelta(result.get(id),delta));
 return result;
}
/* DOKU: Initialisiert gerätebezogene Sequenznummer, Warteschlangen und Cachefelder; benötigt eine Geräte-ID vom Aufrufer. */
export function initialState(deviceId) {
 return {deviceId,seq:0,pending:{},inflight:null,lastSyncAt:0,cloud:[],cloudAt:0,catalogue:null,catalogueAt:0,rounds:{}};
}
/* DOKU: Liefert einen neuen Zustand mit aufsummierter Änderung zur Fragen-ID in pending; der bisherige Zustand wird dabei nicht direkt überschrieben. */
export function enqueue(state,id,delta) {
 return {...state,pending:{...state.pending,[id]:addDelta(state.pending[id],delta)}};
}
/* DOKU: Respektiert das Minutenintervall, außer force ist gesetzt. Wiederholt zuerst inflight; andernfalls werden pending und eine neue Sequenznummer zu einem Versandpaket zusammengefasst. */
export function beginBatch(state,now,force=false) {
 if(!force&&now-state.lastSyncAt<MIN_SYNC_MS)return {state,batch:null};
 if(state.inflight)return {state:{...state,lastSyncAt:now},batch:state.inflight};
 if(!Object.keys(state.pending).length)return {state,batch:null};
 const batch={seq:state.seq+1,deviceId:state.deviceId,deltas:state.pending};
 return {state:{...state,seq:batch.seq,pending:{},inflight:batch,lastSyncAt:now},batch};
}
/* DOKU: Übernimmt bestätigte Zeilen nur für das passende Versandpaket und entfernt dessen inflight-Markierung. Inzwischen neu eingegangene pending-Antworten bleiben erhalten. */
export function acknowledge(state,batch,confirmedRows,now) {
 if(state.inflight?.seq !== batch.seq)return state;
 const cloud=new Map(state.cloud);for(const [id,value]of confirmedRows)cloud.set(id,value);
 return {...state,cloud:[...cloud],cloudAt:now,inflight:state.inflight?.seq===batch.seq?null:state.inflight};
}
