/* DOKU: Prüft Filter, Bedarfslisten und ID-Auswahl mit synthetischen Fragen und Lernständen. */
import assert from 'node:assert/strict';
import {matchesFilters, buildPools, chooseIds, selectionLabel} from '../../quiz-data-core.js';
const selection={semester:['1','2'],subject:['Netzwerktechnik','Programmiertechnik'],topic:['IPv4','Java']};
for(const subject of selection.subject)assert(matchesFilters({semester:'2',subject,topic:'Java'},selection));
for(const change of [{semester:'3'},{subject:'WiSo'},{topic:'DHCP'}])assert(!matchesFilters({semester:'1',subject:'Netzwerktechnik',topic:'IPv4',...change},selection));
assert(!matchesFilters({semester:'1',subject:'Netzwerktechnik',topic:'IPv4'},{...selection,topic:[]}));
assert(matchesFilters({semester:'1',subject:'Java',topic:'OOP'},{semester:'all',subject:'Java',topic:'all'}));
const qs=Array.from({length:5},(_,i)=>({id:String(i)}));
const stats=new Map(qs.map((q,i)=>[q.id,{timesViewed:i,timesPlayed:99,timesWrong:99}]));
const pools=buildPools(qs,stats,'FC');
assert.deepEqual(pools.neu,['0']);assert.deepEqual(pools.hoch,['1']);assert.deepEqual(pools.medium,['2']);assert.deepEqual(pools.gering,['3','4']);
assert.equal(new Set(chooseIds(pools,'gemischt','all','FC')).size,5);
assert.equal(selectionLabel(['1','extra'],'semester'),'1. Semester, Extra');
console.log('PASS: Mehrfachfilter, leere Auswahl, alte Einzelauswahl, FC-Stufen unabhängig von Quizfehlern, Mischung ohne Duplikate.');
