/* DOKU: Prüft die reine Synchronisationslogik mit lokalen Zuständen: Zähler, Wiederholungen von Batches und Bestätigungen. Kein Zugriff auf ein Firebase-Projekt. */
import assert from 'node:assert/strict';
import {initialState,enqueue,beginBatch,acknowledge,overlay,answerDelta,addDelta,shardKey} from '../../private-sync-core.js';
import {buildPools,chooseIds} from '../../quiz-data-core.js';
let state=initialState('device-a'),cloud=new Map(),lastSeq=0,reads=0,writes=0;
const questions=Array.from({length:400},(_,i)=>({id:'q'+i,path:'Semester_1/Java/Thema_1/q'+i}));
let now=100000;
function send(batch){
 const shards=new Set(Object.keys(batch.deltas).map(shardKey));reads+=1+shards.size;
 if(batch.seq>lastSeq){for(const [id,delta]of Object.entries(batch.deltas))cloud.set(id,addDelta(cloud.get(id),delta));lastSeq=batch.seq;writes+=1+shards.size;}
 return [...cloud];
}
for(let repeat=0;repeat<100;repeat++)for(let i=0;i<400;i++){
 const q=questions[i];state=enqueue(state,q.id,answerDelta(q,{isCorrect:i%2===0,type:repeat%2?'MC':'BE'},now));
 if((i+1)%100===0){now+=60000;const started=beginBatch(state,now);state=started.state;const rows=send(started.batch);
 // Re-delivery after a lost acknowledgement does not count the same answers twice.
 if(repeat===0&&i===99)send(started.batch);
 state=acknowledge(state,started.batch,rows,now);}
}
assert.equal([...cloud.values()].reduce((s,q)=>s+q.timesPlayed,0),40000);assert.equal(cloud.get('q0').timesPlayed,100);assert.equal(cloud.get('q1').timesWrong,100);
assert(reads<7000&&writes<7000);
const batchState=enqueue(initialState('device-b'),'q0',answerDelta(questions[0],{isCorrect:true,type:'RF'},now));
const begun=beginBatch(batchState,now);const afterNew=enqueue(begun.state,'q1',answerDelta(questions[1],{isCorrect:false,type:'MC'},now));
const confirmed=acknowledge(afterNew,begun.batch,[['q0',{timesPlayed:1,timesCorrect:1}]],now);
assert.equal(confirmed.pending.q1.timesWrong,1,'Bestätigung verliert keine währenddessen beantwortete Frage');assert(!confirmed.inflight);
assert.equal(beginBatch(confirmed,now+1).batch,null,'Seitenwechsel umgeht Synchronisierungsintervall nicht');
const view=answerDelta(questions[0],{viewed:true,type:'FC'},now);const mixed=addDelta(cloud.get('q0'),view);assert.equal(mixed.timesPlayed,100);assert.equal(mixed.timesViewed,1);
const pending=enqueue(state,'q0',answerDelta(questions[0],{isCorrect:true,type:'MC'},now));assert.equal(overlay(pending.cloud,pending.pending,pending.inflight).get('q0').timesPlayed,101);
const pools=buildPools(questions,cloud,'MC');assert.equal(new Set(chooseIds(pools,'gemischt','all','MC')).size,400);
console.log(`PASS: 40.000 Antworten über gemeinsame Quizarten, ${reads} modellierte Sync-Reads / ${writes} Writes, idempotente Wiederholung, Pending-Erhaltung, Intervall und FC ohne Bewertungsänderung.`);
