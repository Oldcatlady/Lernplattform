/* DOKU: Lokales Konfigurationswerkzeug: liest private-settings.json und schreibt daraus firestore.rules und .firebaserc. Kein Deployment, aber reale Änderungen an diesen lokalen Dateien bei Ausführung. */
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const config=JSON.parse(await readFile(new URL('private-settings.json',root),'utf8'));
const project=config.firebaseConfig?.projectId,uid=config.ownerUid;
if(!/^[a-z][a-z0-9-]{4,29}$/.test(project||'')||project==='example-original-project')throw new Error('Bitte eine NEUE private projectId eintragen. Das Originalprojekt ist als Ziel gesperrt.');
if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid||'')||uid==='OWNER_UID_HERE')throw new Error('Bitte deine echte Authentication-UID eintragen.');
if(!config.firebaseConfig.apiKey||config.firebaseConfig.apiKey==='API_KEY_HERE'||!config.firebaseConfig.appId||config.firebaseConfig.appId==='APP_ID_HERE')throw new Error('Firebase-Webkonfiguration fehlt.');
/* DOKU: Die UID wird in die Regelvorlage eingesetzt. Das Ergebnis wird erst durch eine spätere gesonderte Veröffentlichung serverseitig wirksam. */
const template=await readFile(new URL('firestore.rules.template',root),'utf8');
await writeFile(new URL('firestore.rules',root),template.replaceAll('OWNER_UID_HERE',uid));
await writeFile(new URL('.firebaserc',root),JSON.stringify({projects:{default:project}},null,2)+'\n');
console.log(`Lokale Konfiguration für ${project} und ausschließlich deine UID erstellt. Keine Cloud-Änderung.`);
