/* DOKU: Lokale Integrationsprüfungen mit selbst gebautem DOM, Firebase-Nachbildung und VM-Modulen. Deckt Dashboard, Quiz und Synchronisation ab; echte Browser- und Firebase-Eigenschaften werden nur teilweise nachgebildet. */
// Offline: echte Seitenmodule mit simuliertem DOM und Firestore.
// Keine Verbindung zu Firebase; kein Browser-/Layouttest.
// node --experimental-vm-modules tools/tests/offline-tests.mjs
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dummyQuestions, semesters, metadataFor, validateQuestion} from '../fragen-schema.mjs';
import {buildPools, chooseIds, inventoryFromSubjects} from '../../quiz-data-core.js';
import {shardKey as statsShardKey} from '../../private-sync-core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const fixtures=JSON.parse(await readFile(path.join(root,'tools/tests/dom-fixtures.json'),'utf8'));
function storage() {return Object.assign({}, {getItem(k){return Object.hasOwn(this,k)?this[k]:null;},setItem(k,v){this[k]=String(v);},removeItem(k){delete this[k];}});}
class Element {
  constructor(tag, attrs={}, text='') {
    this.tagName=tag.toUpperCase();this.attrs=attrs;this.children=[];this.textContent=text.trim();this.events={};this.dataset={};
    this.id=attrs.id||'';this.value=attrs.value||'';this.disabled=Object.hasOwn(attrs,'disabled');this.hidden=Object.hasOwn(attrs,'hidden');
    this._className=attrs.class||'';this.style={setProperty(){}};
    for(const [k,v] of Object.entries(attrs)) if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,l)=>l.toUpperCase())]=v;
    const classes=()=>new Set(this._className.split(/\s+/).filter(Boolean));
    this.classList={add:(...a)=>{this._className=[...new Set([...classes(),...a])].join(' ');},remove:(...a)=>{this._className=[...classes()].filter(c=>!a.includes(c)).join(' ');},contains:c=>classes().has(c),toggle:(c,on)=>{const set=classes();if(on===undefined?!set.has(c):on)set.add(c);else set.delete(c);this._className=[...set].join(' ');}};
  }
  set className(v){this._className=v;}get className(){return this._className;}
  set innerHTML(v){this.children=[];this.textContent='';const m=String(v).match(/<option value="([^"]*)">([^<]*)/);if(m)this.appendChild(new Element('option',{value:m[1]},m[2]));}
  appendChild(node){node.parent=this;this.children.push(node);return node;}append(...nodes){nodes.forEach(n=>this.appendChild(n));}add(node){this.appendChild(node);}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attrs[k]=String(v);}focus(){}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn);}async fire(type){for(const fn of this.events[type]||[])await fn({target:this,key:'Enter',preventDefault(){}});await new Promise(setImmediate);await new Promise(setImmediate);}
  async click(){if(!this.disabled)await this.fire('click');}
  querySelectorAll(selector){return select(this,selector);}
}
function descendants(e){return e.children.flatMap(c=>[c,...descendants(c)]);}
function matches(e,s){
 const attr=s.match(/\[([^\]]+)\]/);if(attr&&!Object.hasOwn(e.attrs,attr[1]))return false;
 s=s.replace(/\[[^\]]+\]/g,'');
 if(s.startsWith('#'))return e.id===s.slice(1);
 if(s.startsWith('.'))return e.classList.contains(s.slice(1));
 return e.tagName===s.toUpperCase();
}
function select(e,s){const parts=s.split(/\s+/);return descendants(e).filter(node=>{
 if(!matches(node,parts.at(-1)))return false;
 if(parts.length===1)return true;
 for(let p=node.parent;p;p=p.parent)if(matches(p,parts[0]))return true;
 return false;
});}
function makeDOM(name){
 const create=raw=>{const e=new Element(raw.tag,raw.attrs,raw.text||'');raw.children.forEach(c=>e.appendChild(create(c)));return e;};
 const tree=create(fixtures[name]);
 return {body:select(tree,'body')[0],head:select(tree,'head')[0],getElementById:id=>descendants(tree).find(e=>e.id===id),createElement:tag=>new Element(tag),querySelectorAll:s=>select(tree,s)};
}
class Timestamp {
 constructor(ms){this.seconds=Math.floor(ms/1000);this.nanoseconds=(ms%1000)*1e6;}
 toMillis(){return this.seconds*1000+this.nanoseconds/1e6;}toDate(){return new Date(this.toMillis());}
 toJSON(){return {seconds:this.seconds,nanoseconds:this.nanoseconds,type:'firestore/timestamp/1.0'};}
 static fromMillis(ms){return new Timestamp(ms);}
 static now(){return new Timestamp(Date.now());}
}
const db=new Map();const calls=[];const writes=[];let auto=0;
function ref(...args){if(typeof args[0]!=='string')args.shift();return {path:args.join('/')};}
function snapshot(p){
 if(p==='privateContent/catalogue')return {id:'catalogue',exists:()=>true,data:()=>({schemaVersion:3,version:'mock-v1',packs:[{id:'all',contentPath:'Semester_1/WiSo/Thema_1/pack-all',metadataPath:'Semester_1/WiSo/Thema_1/meta-all'}]})};
 if(p==='Semester_1/WiSo/Thema_1/meta-all')return {id:'meta-all',exists:()=>true,data:()=>({questions:inventory.map(q=>({...q,pack:'Semester_1/WiSo/Thema_1/pack-all'}))})};
 if(p==='Semester_1/WiSo/Thema_1/pack-all')return {id:'pack-all',exists:()=>true,data:()=>({questions:inventory.map(q=>({...db.get(q.path),id:q.id,path:q.path}))})};
 return {id:p.split('/').at(-1),ref:ref(p),exists:()=>db.has(p),data:()=>db.get(p)};}
function list(p,constraints=[]){
 let rows=[...db.keys()].filter(k=>k.startsWith(p+'/')&&k.split('/').length===p.split('/').length+1);
 for(const c of constraints){if(c.kind==='where'){assert.equal(c.field,'__name__');assert.equal(c.op,'in');assert(c.value.length<=30);rows=rows.filter(k=>c.value.includes(k.split('/').at(-1)));}if(c.kind==='limit')rows=rows.slice(0,c.value);}
 return {docs:rows.map(snapshot),size:rows.length};
}
// Initial data: all 204 German questions and a small ID-only inventory.
const subjects=[];
for(const s of semesters){for(const name of s.subjects){
 const rows=Object.values(dummyQuestions(s.id,name)).flat().map(data=>({id:'auto-'+(++auto),data}));
 rows.forEach(({id,data})=>db.set(`Semester_${s.id}/${name}/Thema_1/${id}`,data));
 const meta={name,themen:['Thema_1'],questionIdsByTopic:metadataFor(rows)};
 db.set(`Semester_${s.id}/${name}`,meta);subjects.push({...meta,documentId:name,semester:s.id});
}}
db.set('katalog/semester',{ids:['Semester_1','Semester_2']});
const inventory=inventoryFromSubjects(subjects);
assert.equal(inventory.length,204);
for(const type of ['MC','FC','BE','RF'])assert.equal(inventory.filter(q=>q.quizTypes.includes(type)).length,68);
const wiso=inventory.filter(q=>q.semester==='1'&&q.subject==='WiSo');
const mc=wiso.filter(q=>q.quizTypes.includes('MC'));
for(let i=1;i<4;i++)db.set(`users/test-user/questionStats/${mc[i].id}`,{timesPlayed:10,timesWrong:[0,9,5,1][i],lastPlayed:Timestamp.fromMillis(Date.now())});
for(const [path,data] of [...db]) if(path.startsWith('users/')&&path.includes('/questionStats/')) {
 const id=path.split('/').at(-1),uid=path.split('/')[1],target=`users/${uid}/learningState/${statsShardKey(id)}`;
 db.set(target,{entries:{...(db.get(target)?.entries||{}),[id]:data}});
}
const durable=new Map();
const shared=storage();const local=storage();
async function environment({page,enabled=true,source='static',uid='test-user',session=shared,server=db}={}) {
 const document=page?makeDOM(page):undefined;
 const location={href:'',replace(v){this.href=v;}};
 const auth={currentUser:{uid,email:'test@example.test'}};const callbacks=[];const errors=[];
 const context=vm.createContext({console:{log(){},error:(...args)=>errors.push(args.join(' ')),warn(){}},Date,Map,Set,JSON,Math,Number,String,Array,Object,Promise,TextEncoder,crypto:{randomUUID:()=> 'device-mock'},setInterval:()=>0,clearInterval(){},sessionStorage:session,localStorage:local,document,location,window:{location,addEventListener(){},scrollTo(){}},fetch:async url=>({ok:true,text:async()=>'',json:async()=>String(url).endsWith('manifest.json')?{schemaVersion:1,questions:inventory.map(q=>({...q,bundle:'bundle-abcd.json'}))}:inventory.map(q=>({...db.get(q.path),id:q.id,path:q.path}))}),DOMParser:class{parseFromString(){return {body:{children:[]},querySelectorAll:()=>[]};}},Option:function(text,value){return new Element('option',{value},text);},alert(){}});
 const exports={initializeApp:()=>({}),getFirestore:()=>({}),getAuth:()=>auth,onAuthStateChanged:(a,fn)=>callbacks.push(fn),signOut:async()=>{},
 doc:ref,collection:ref,query:(r,...constraints)=>({...r,constraints}),where:(field,op,value)=>({kind:'where',field,op,value}),documentId:()=>'__name__',limit:value=>({kind:'limit',value}),Timestamp,
 getDoc:async r=>{calls.push({kind:'get',path:r.path});return snapshot(r.path);},
 getDocs:async r=>{calls.push({kind:'list',path:r.path,constraints:r.constraints||[]});assert.notEqual(r.path,'fragen');return list(r.path,r.constraints);},
 serverTimestamp:()=>Timestamp.fromMillis(Date.now()),
 runTransaction:async(d,fn)=>{const staged=[];const result=await fn({get:async r=>{calls.push({kind:'transaction-read',path:r.path});return snapshot(r.path);},set:(r,data,opt)=>staged.push([r.path,opt?.merge?{...(db.get(r.path)||{}),...data,entries:{...(db.get(r.path)?.entries||{}),...(data.entries||{})}}:data])});for(const [p,data]of staged){db.set(p,data);writes.push(p);}return result;}};
 const modules=new Map();
 const synthetic=(values,id)=>new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context,identifier:id});
 async function load(id){if(modules.has(id))return modules.get(id);let m;
  if(id.startsWith('https:'))m=synthetic(exports,id);
  // DOM-Adapter für den alten Offline-Harness; echte Checkbox-UI separat im Browser geprüft.
  else if(id.endsWith('multi-select.js'))m=synthetic({createMultiSelect:el=>{
   Object.defineProperty(el,'values',{get(){return Array.isArray(this.value)?this.value:this.value?[this.value]:[];}});
   el.setOptions=items=>{const options=items.map(v=>typeof v==='object'?v.value:v);if(!options.includes(el.value))el.value='';el.disabled=!items.length;};
   return el;
  }},id);
  else if(id.endsWith('firebase-config.js'))m=synthetic({firebaseConfig:{projectId:'private-test'},privateSettings:{ownerUid:'test-user'},requirePrivateSetup(){}},id);
  else if(id.endsWith('private-store.js'))m=synthetic({readState:async key=>durable.get(key),updateState:async(key,fn)=>{const result=fn(durable.get(key));durable.set(key,result);return result;}},id);
  else if(id.endsWith('data-access-config.js'))m=synthetic({FIRESTORE_READS_ENABLED:enabled,DATA_CACHE_TTL_MS:600000,CONTENT_SOURCE:source},id);
  else m=new vm.SourceTextModule(await readFile(id,'utf8'),{context,identifier:id});
  modules.set(id,m);return m;
 }
 async function link(specifier,parent){return load(specifier.startsWith('https:')?specifier:path.resolve(path.dirname(parent.identifier),specifier));}
 async function module(id){const m=await load(path.resolve(root,id));if(m.status==='unlinked')await m.link(link);if(m.status!=='evaluated')await m.evaluate();return m.namespace;}
 if(page){const html=await readFile(path.join(root,page),'utf8');const code=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>/type="module"/.test(m[1])).map(m=>m[2]).join('\n');
  const m=new vm.SourceTextModule(code,{context,identifier:path.join(root,page)});await m.link(link);await m.evaluate();for(const fn of callbacks)await fn(auth.currentUser);
  await new Promise(setImmediate);await new Promise(setImmediate);
 }
 return {document,location,errors,module,context};
}
// Foreign account cannot read private content or its own stats.
const locked=await environment({uid:'foreign'});const lockedData=await locked.module('quiz-data.js');const beforeLocked=calls.length;
await assert.rejects(lockedData.loadInventory({},'foreign'),/Nur dein/);assert.equal(calls.length,beforeLocked);
// Start dashboard: metadata only; no question documents and no personal stats.
let e=await environment({page:'quizBit.html'});assert.deepEqual(e.errors,[]);
assert.equal(calls.filter(c=>/\/pack-/.test(c.path)).length,0);
assert.equal(calls.filter(c=>c.path.startsWith('users/')).length,0);
assert.equal(calls.length,2); // catalogue + two subject queries, 18 returned metadata documents.
const el=id=>e.document.getElementById(id);
el('semester').value='1';await el('semester').fire('change');el('subject').value='WiSo';await el('subject').fire('change');el('topic').value='Thema_1';await el('topic').fire('change');
let button=e.document.querySelectorAll('.quiz-type[data-type]').find(b=>b.dataset.type==='MC');await button.click();
assert.equal(calls.at(-1).path,'users/test-user/learningState');assert.equal(calls.at(-1).constraints[0].value,17);
for(const cat of ['neu','hoch','medium','gering'])assert.match(e.document.querySelectorAll('#lernstandButtons button').find(b=>b.dataset.category===cat).textContent,/\(1\)$/);
let prev=calls.length;await button.click();assert.equal(calls.length,prev,'Wiederholte Auswahl nutzt Statistikcache');
await el('startQuiz').click();assert.equal(e.location.href,'mc.html');
const selected=JSON.parse(shared.getItem('quizSelection'));assert.equal(selected.questionPaths.length,4);
// MC: exactly four chosen question reads; multiple-choice exact match and review.
e=await environment({page:'mc.html'});assert.deepEqual(e.errors,[]);
assert.equal(calls.filter(c=>c.kind==='get'&&inventory.some(q=>q.path===c.path)).length,0);
for(let i=0;i<4;i++){
 const title=e.document.getElementById('question').textContent;
 const data=mc.map(q=>db.get(q.path)).find(q=>q.Frage===title);assert(data);
 const correct=data['Korrekte-Antwort'].split(',');
 for(const option of e.document.querySelectorAll('#options button'))if(correct.includes(option.dataset.letter))await option.click();
 await e.document.getElementById('check').click();await e.document.getElementById('next').click();
}
assert.match(e.document.getElementById('summary').textContent,/4 richtig, 0 falsch/);
prev=calls.length;await e.document.getElementById('restart').click();assert.equal(calls.length,prev,'Neustart lädt keine Fragen');
// Remaining quiz modes: preserve German fields, per-user writes and no scans.
for(const [type,page]of [['BE','be.html'],['RF','quiz.html'],['FC','fc.html']]){
 const qs=wiso.filter(q=>q.quizTypes.includes(type));shared.setItem('quizSelection',JSON.stringify({semester:['1'],subject:['WiSo'],topic:['Thema_1'],quizType:type,questionCount:5,questionIds:qs.map(q=>q.id),questionPaths:qs.map(q=>q.path)}));
 e=await environment({page});assert.deepEqual(e.errors,[]);prev=calls.length;
 for(let i=0;i<4;i++){
  if(type==='BE'){
   const data=qs.map(q=>db.get(q.path)).find(q=>q.Frage===e.document.getElementById('question').textContent);assert(data);
   const input=e.document.getElementById('text-input');input.value=data.Eingabe;await input.fire('input');await e.document.getElementById('check').click();
  }else if(type==='RF'){
   const data=qs.map(q=>db.get(q.path)).find(q=>q.Frage===e.document.getElementById('statement').textContent);assert(data);
   await e.document.querySelectorAll('#options button').find(b=>b.dataset.answer===(data['Korrekte-Antwort']==='Richtig'?'true':'false')).click();
  }else{
   await e.document.getElementById('card').click();assert.equal(e.document.getElementById('card-side').textContent,'Antwort');
   assert(e.document.getElementById('card-content').children.length>=1);
  }
  await e.document.getElementById('next').click();
 }
 assert.deepEqual(e.errors,[]);
 assert(!calls.slice(prev).some(c=>c.path.startsWith('Semester_')),'Antworten lesen keine Frageinhalte');
 assert.match(e.document.getElementById('summary').textContent,type==='FC'?/4 Karten gelernt/:/4 richtig, 0 falsch/);
}
// Mixed round traverses all question modes without a question collection scan.
const mix=wiso;
shared.setItem('quizSelection',JSON.stringify({semester:'all',subject:'all',topic:'all',quizType:'MIXED',questionCount:'all',questionPaths:mix.map(q=>q.path)}));
e=await environment({page:'mixed.html'});assert.deepEqual(e.errors,[]);
for(const q of mix){
 const type=q.quizTypes.includes('BE')?'BE':q.quizTypes.includes('MC')?'MC':q.quizTypes.includes('RF')?'RF':'FC';
 const raw=db.get(q.path);
 if(type==='BE')e.document.getElementById('entry').value=raw.Eingabe;
 else for(const b of e.document.querySelectorAll('#options button'))if(raw['Korrekte-Antwort'].split(',').includes(b.dataset.value))await b.click();
 await e.document.getElementById('check').click();await e.document.getElementById('next').click();
}
assert.deepEqual(e.errors,[]);assert.match(e.document.getElementById('result').textContent,/12 richtig, 0 falsch/);

// Statistics contain new questions and combine MC/FC without double counting.
prev=calls.length;e=await environment({page:'statistik.html'});assert.deepEqual(e.errors,[]);
assert(!calls.slice(prev).some(c=>c.path.startsWith('Semester_')),'Statistik nutzt gemeinsamen Metadatencache');
assert(!calls.slice(prev).some(c=>inventory.some(q=>q.path===c.path)));
assert.equal(e.document.querySelectorAll('.subject-row').length,17);
assert.equal(e.document.querySelectorAll('.topic-row').length,17);
// Session navigation preserves Firestore timestamps.
const next=await environment();const data=await next.module('quiz-data.js');const stats=await data.loadAllStats({},'test-user');assert.equal(typeof stats.get(mc[1].id).lastPlayed.toDate,'function');
// Old/forged selection must not trigger any whole-collection fallback.
await assert.rejects(data.loadRoundQuestions({},'test-user',{...selected,questionPaths:undefined}),/Dashboard/);
await assert.rejects(data.loadRoundQuestions({},'test-user',{...selected,questionPaths:['Semester_2/Android/Thema_1/nope']}),/Auswahl/);
// A different UID has no access, even with modified client selection.
prev=calls.length;await assert.rejects(data.loadSelectedStats({},'other-user',mc.map(q=>q.id)),/Nur dein/);assert.equal(calls.length,prev);
// Mixed categories do not duplicate wrong questions; FC stays independent.
const pools=buildPools(mc,new Map(mc.map((q,i)=>[q.id,{timesPlayed:i?10:0,timesWrong:i?10:0}])),'MC');
assert.equal(new Set(chooseIds(pools,'gemischt','all','MC')).size,4);
assert.equal(buildPools(mc,stats,'FC').neu.length,0);
assert.equal(buildPools(mc,stats,'FC').hoch.length,4);
assert(writes.every(p=>/users\/test-user\/(learningState\/s\d{2}|syncDevices\/device-mock)$/.test(p)));
assert.equal([...stats.values()].filter(s=>s.timesViewed>0).length,4);
prev=calls.length;await data.loadSelectedStats({},'test-user',inventory.map(q=>q.id));assert.equal(calls.length,prev,'Alle Semester lesen den Lernstand innerhalb der Sitzung nicht erneut');
// Query chunking, including missing/new stats: 65 IDs -> 3 bounded queries.
prev=calls.length;await data.loadSelectedStats({},'test-user',Array.from({length:65},(_,i)=>'q'+i));assert.equal(calls.length-prev,0);
// Force final device-switch sync; the actual adapter uploads all pending answers.
const sync=await next.module('private-sync.js');await sync.flush({},'test-user',true);
let persisted=[...db].filter(([path])=>path.includes('/learningState/')).flatMap(([,data])=>Object.entries(data.entries));
assert.equal(persisted.reduce((sum,[,v])=>sum+(v.timesPlayed||0),0),54);
assert.equal(persisted.reduce((sum,[,v])=>sum+(v.timesViewed||0),0),4);
const beforeAgain=JSON.stringify(persisted);await sync.flush({},'test-user',true);
persisted=[...db].filter(([path])=>path.includes('/learningState/')).flatMap(([,data])=>Object.entries(data.entries));assert.equal(JSON.stringify(persisted),beforeAgain);
console.log('PASS: private geschützte Inhalte, gesammelte Synchronisierung, deutsche Frageformate, alle vier Quizabläufe, Mehrfachantwort, Kategorien/Mischung, Statistik, Cache, Kontotrennung, Lesesperre und Abfragebegrenzung.');
console.log(`Simulierte API-Aufrufe: ${calls.length}; persönliche Schreibvorgänge: ${writes.length}. Keine Verbindung zu Firebase.`);
