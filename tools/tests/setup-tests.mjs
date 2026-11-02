/* DOKU: Prüft lokale Konfigurations- und Datenstrukturannahmen anhand von Projektdateien und synthetischen Fragen. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {dummyQuestions} from '../fragen-schema.mjs';
const root=await mkdtemp(join(tmpdir(),'fiae-private-'));await mkdir(join(root,'tools'));
for(const file of ['configure-private.mjs','import-private.mjs','fragen-schema.mjs','private-content-plan.mjs'])await copyFile(new URL('../'+file,import.meta.url),join(root,'tools',file));
await copyFile(new URL('../../firestore.rules.template',import.meta.url),join(root,'firestore.rules.template'));
const settings={ownerUid:'my-private-uid',firebaseConfig:{projectId:'new-private-project',apiKey:'example',appId:'example'}};
await writeFile(join(root,'private-settings.json'),JSON.stringify(settings));
let run=spawnSync(process.execPath,[join(root,'tools/configure-private.mjs')],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
assert.equal(JSON.parse(await readFile(join(root,'.firebaserc'),'utf8')).projects.default,'new-private-project');
const rules=await readFile(join(root,'firestore.rules'),'utf8');assert(rules.includes("request.auth.uid == 'my-private-uid'"));assert(!rules.includes('OWNER_UID_HERE'));assert(!rules.includes('getAfter('));
const rows=Object.values(dummyQuestions('1','WiSo')).flat().map((data,i)=>({id:'q'+i,path:`Semester_1/WiSo/Thema_1/q${i}`,data}));
await writeFile(join(root,'questions.json'),JSON.stringify(rows));
run=spawnSync(process.execPath,[join(root,'tools/import-private.mjs'),join(root,'questions.json')],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/12 Fragen/);
settings.firebaseConfig.projectId='example-original-project';await writeFile(join(root,'private-settings.json'),JSON.stringify(settings));
for(const script of ['configure-private.mjs','import-private.mjs']){run=spawnSync(process.execPath,[join(root,'tools',script),join(root,'questions.json')],{encoding:'utf8'});assert.notEqual(run.status,0,'Originalprojekt muss als Ziel abgelehnt werden.');}
assert.equal(JSON.parse(await readFile(join(root,'.firebaserc'),'utf8')).projects.default,'new-private-project');
console.log('PASS: Einrichtung ausschließlich für neue projectId / Owner-UID, Import-Trockenlauf, geschützte Regeln und Schutz des Originalprojekts.');
