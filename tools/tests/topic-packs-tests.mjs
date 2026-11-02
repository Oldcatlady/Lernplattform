/* DOKU: Prüft Themen-/Größentrennung, Hashversionen und eindeutige IDs bei der Paketplanung mit synthetischen Eingaben. */
import assert from 'node:assert/strict';
import {buildPlan} from '../private-content-plan.mjs';
import {readFile} from 'node:fs/promises';
const base={Semester:'Semester 2',Fach:'WiSo',Thema:'Recht','Quiz-Möglichkeit':'MC, FC',Frage:'Frage', 'Antwortoption A':'A','Antwortoption B':'B','Antwortoption C':'C','Antwortoption D':'D','Korrekte-Antwort':'A',Erklärung:'Erklärung',Eingabe:''};
const rows=Array.from({length:102},(_,i)=>{const id='q'+i,data={...base,Thema:i===101?'Markt':'Recht',Frage:'Frage '+i};return {id,path:`Semester_2/WiSo/${data.Thema}/${id}`,data};});
const plan=buildPlan(rows);assert.equal(plan.packs.length,3);
for(const p of plan.packs){assert.match(p.contentPath,/^Semester_2\/WiSo\/(Markt|Recht)\/pack-[a-f0-9]{64}$/);const raw=plan.documents.find(([path])=>path===p.contentPath)[1].questions;assert(raw.length<=100);assert.equal(new Set(raw.map(q=>q.Thema)).size,1);const meta=plan.documents.find(([path])=>path===p.metadataPath)[1].questions;assert(meta.every(q=>q.pack===p.contentPath));assert.deepEqual(raw.map(q=>q.id),meta.map(q=>q.id));}
assert.equal(buildPlan([...rows].reverse()).version,plan.version);
assert.throws(()=>buildPlan([...rows,rows[0]]),/eindeutig/);
const changed=rows.map(q=>({...q,data:{...q.data}}));changed[0].data.Erklärung='Neue Erklärung';assert.notEqual(buildPlan(changed).version,plan.version);assert.deepEqual(buildPlan(changed).questions.map(q=>q.meta.id),plan.questions.map(q=>q.meta.id));
console.log('PASS: Themen getrennt, maximal 100 Fragen pro Paket, stabile IDs, versionierte Inhalte und passende Übersichtspfade.');
