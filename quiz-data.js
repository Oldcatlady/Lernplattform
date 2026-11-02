/* DOKU: Datenzugriff der Browserseiten: Katalog und Metadaten dienen der Auswahl, Inhaltspakete liefern erst die gewählten Fragen. Lernstände kommen aus private-sync.js. */
import {getDoc,doc} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import {matchesFilters,quizTypes} from './quiz-data-core.js';
import {requireOwner} from './private-auth.js';
import {readState,updateState} from './private-store.js';
import {loadLearningState,manualSync,stopSync,privateStateKey} from './private-sync.js';
const running=new Map();
/* DOKU: Kontogebundener IndexedDB-Cache mit Zeitstempel und optionaler Gültigkeitsdauer. running teilt gleichzeitig laufende Ladevorgänge; persistente Werte liegen in private-store.js. Eine lokale UID-Prüfung ersetzt keine Firestore-Regel. */
function cached(uid,name,loader,ttl=Infinity){
 requireOwner(uid);const key=privateStateKey(uid)+':content:'+name;
 if(running.has(key))return running.get(key);
 const task=(async()=>{const old=await readState(key);if(old&&Date.now()-old.at<ttl)return old.value;
 const value=await loader();await updateState(key,()=>({at:Date.now(),value}));return value;})();running.set(key,task);
 task.finally(()=>running.delete(key)).catch(()=>{});return task;
}
/* DOKU: Lädt privateContent/catalogue mit Schema 3 und prüft die Paketverweise. Katalog und nachfolgende Metadaten/Inhalte werden hier fünf Minuten zwischengespeichert. */
async function catalogue(db,uid){return cached(uid,'catalogue:v3',async()=>{const s=await getDoc(doc(db,'privateContent','catalogue'));if(!s.exists())throw new Error('Bitte zuerst deine Fragen in das neue Projekt importieren.');const data=s.data();if(data.schemaVersion!==3||!Array.isArray(data.packs)||!data.version||data.packs.some(p=>!p||typeof p.contentPath!=='string'||typeof p.metadataPath!=='string'))throw new Error('Fragenübersicht ungültig.');return data;},300_000);}
/* DOKU: Lädt die Metadatenpakete in Gruppen von höchstens vier parallelen Zugriffen und gibt eine flache Liste von Fragenreferenzen zurück, ohne vollständige Antwortinhalte zu laden. */
export async function loadInventory(db,uid){
 const index=await catalogue(db,uid);const all=[];
 for(let start=0;start<index.packs.length;start+=4){const rows=await Promise.all(index.packs.slice(start,start+4).map(id=>cached(uid,'meta:'+id.metadataPath,async()=>{const s=await getDoc(doc(db,id.metadataPath));if(!s.exists())throw new Error('Fragenübersicht unvollständig.');return s.data().questions;},300_000)));all.push(...rows.flat());}
 return all;
}
/* DOKU: Lädt den gemeinsamen Lernstand und liefert daraus nur Einträge für die angefragten IDs als Map. Die ID-Liste begrenzt hier nicht die Firestore-Abfrage. */
export async function loadSelectedStats(db,uid,ids){const all=await loadLearningState(db,uid);return new Map(ids.filter(id=>all.has(id)).map(id=>[id,all.get(id)]));}
/* DOKU: Alias auf den Synchronisationslader: Statistik und Quiz verwenden dieselbe lokale/Cloud-Sicht. */
export const loadAllStats=loadLearningState;
/* DOKU: Prüft Typ, Filter, Pfade und Anzahl der Dashboard-Auswahl. Entdoppelt Pfade, lädt benötigte Inhaltspakete und kombiniert Rohfragen mit Metadaten in der ausgewählten Pfadreihenfolge. Unpassende Referenzen führen zum Abbruch. */
export async function loadRoundQuestions(db,uid,selection){
 requireOwner(uid);
 if(!selection||!Array.isArray(selection.questionPaths)||!selection.questionPaths.length)throw new Error('Bitte im Dashboard einen Durchlauf auswählen.');
 if(!['MC','FC','BE','RF','MIXED'].includes(selection.quizType))throw new Error('Quizart ungültig.');
 const inventory=await loadInventory(db,uid),allowed=new Map(inventory.filter(q=>matchesFilters(q,selection)&&(selection.quizType==='MIXED'||q.quizTypes.includes(selection.quizType))).map(q=>[q.path,q]));
 const paths=[...new Set(selection.questionPaths)];if(paths.some(path=>!allowed.has(path)))throw new Error('Fragen passen nicht zur Auswahl.');
 if(selection.questionCount!=='all'&&(!Number.isInteger(selection.questionCount)||selection.questionCount<1||paths.length>selection.questionCount))throw new Error('Fragenanzahl ungültig.');
 const packs=[...new Set(paths.map(path=>allowed.get(path).pack))],raw=new Map();
 for(let start=0;start<packs.length;start+=4){const rows=await Promise.all(packs.slice(start,start+4).map(id=>cached(uid,'pack:'+id,async()=>{const s=await getDoc(doc(db,id));if(!s.exists())throw new Error('Fragenpaket fehlt.');return s.data().questions;},300_000)));for(const q of rows.flat())raw.set(q.path,q);}
 return paths.map(path=>{const q=raw.get(path),meta=allowed.get(path);if(!q||!(selection.quizType==='MIXED'||quizTypes(q).includes(selection.quizType)))throw new Error('Frage oder Quizart ungültig.');return {...q,...meta};});
}
/* DOKU: Delegiert den manuellen Abgleich an private-sync.js; leert hier nicht den Inhaltspaketcache. */
export async function refreshPrivateData(db,uid){return manualSync(db,uid);}
/* DOKU: Stoppt Synchronisationsintervalle und leert die Map laufender Inhaltsladevorgänge. Bereits gespeicherte IndexedDB-Daten und ausstehende Antworten bleiben bestehen. */
export function clearDataCache(){stopSync();running.clear();/* Nicht synchronisierte Antworten beim Logout nicht löschen. */}
export {readQuizSelection} from './quiz-data-core.js';
