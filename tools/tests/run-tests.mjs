/* DOKU: Startet die vorhandenen Testmodule. Einige benötigen Node-VM-Unterstützung; dieses Startskript wurde im Kommentierungsauftrag nicht ausgeführt. */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
for(const file of ['filter-tests.mjs','core-tests.mjs','page-tests.mjs','setup-tests.mjs','topic-packs-tests.mjs']) {
 const run=spawnSync(process.execPath,['--experimental-vm-modules',fileURLToPath(new URL(file,import.meta.url))],{stdio:'inherit'});
 if(run.status!==0)process.exit(run.status||1);
}
