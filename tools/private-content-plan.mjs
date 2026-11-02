/* DOKU: Reine Planung von Fragenpaketen ohne Firestore-Verbindung. buildPlan validiert IDs und Pfade, trennt Metadaten von Inhalten und liefert Dokumentpaare sowie eine Katalogversion. */
import {createHash} from 'node:crypto';
import {validateQuestion} from './fragen-schema.mjs';
/* DOKU: Eingabe: Zeilen aus id, path und data. Rückgabe: normalisierte Fragen, Paketverweise, Dokumentdaten und Hashversion. Fehlerhafte oder doppelte IDs führen zum Abbruch. */
export function buildPlan(rows){
const ids=new Set();
const questions=rows.map(({id,path,data})=>{
 const meta=validateQuestion(data);
 if(typeof id!=='string'||!id||id.includes('/')||['__proto__','constructor','prototype'].includes(id)||ids.has(id))throw new Error('Frage-ID fehlt oder ist nicht eindeutig.');ids.add(id);
 if(path!==`Semester_${meta.semester}/${meta.subject}/${meta.topic}/${id}`)throw new Error('Felder und Pfad passen nicht: '+path);
 const fields=['Semester','Fach','Thema','Quiz-Möglichkeit','Frage','Antwortoption A','Antwortoption B','Antwortoption C','Antwortoption D','Korrekte-Antwort','Erklärung','Eingabe'];
 return {meta:{id,path,semester:meta.semester,subject:meta.subject,topic:meta.topic,quizTypes:meta.types},raw:{...Object.fromEntries(fields.map(k=>[k,data[k]??''])),id,path}};
}).sort((a,b)=>a.meta.path.localeCompare(b.meta.path));
const packs=[],documents=[];
// Nach Dokumentgröße UND Anzahl begrenzen.
let current=[];
/* DOKU: Erzeugt aus einem Themenblock ein Inhaltspaket und sein Metadatenpaket. SHA-256 des Inhalts bildet die unveränderliche Pfadkennung; Metadaten verweisen auf das Inhaltspaket. */
function pack(chunk){if(!chunk.length)return;const raw=chunk.map(q=>q.raw);const hash=createHash('sha256').update(JSON.stringify(raw)).digest('hex');const first=chunk[0].meta;const base=`Semester_${first.semester}/${first.subject}/${first.topic}`;const contentPath=base+'/pack-'+hash,metadataPath=base+'/meta-'+hash;packs.push({id:hash,contentPath,metadataPath});
 documents.push([contentPath,{questions:raw}],[metadataPath,{questions:chunk.map(q=>({...q.meta,pack:contentPath}))}]);}
/* DOKU: Neue Pakete beginnen bei Themen-/Fach-/Semesterwechsel oder bei mehr als 100 Fragen bzw. 650000 geschätzten JSON-Bytes. Diese Grenze hält Abstand zur Firestore-Dokumentgrenze; sie ist keine exakte Firestore-Größenberechnung. */
for(const q of questions){const candidate=[...current,q];if(current.length&&(q.meta.semester!==current[0].meta.semester||q.meta.subject!==current[0].meta.subject||q.meta.topic!==current[0].meta.topic||candidate.length>100||Buffer.byteLength(JSON.stringify(candidate))>650000)){pack(current);current=[];}if(Buffer.byteLength(JSON.stringify(q))>650000)throw new Error('Einzelfrage zu groß.');current.push(q);}pack(current);
const version=createHash('sha256').update(JSON.stringify(packs)).digest('hex');
if(Buffer.byteLength(JSON.stringify(packs))>650000)throw new Error('Katalog zu groß.');
return {questions,packs,documents,version};
}
