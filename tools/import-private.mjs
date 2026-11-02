
/* DOKU: Additiver Import: ohne --write nur lokale Eingabevalidierung. Der Schreibmodus verwendet Firebase Admin und legt neue Inhaltspakete an; dieses Werkzeug gehört nicht zum Browserbetrieb. */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildPlan} from './private-content-plan.mjs';

/* DOKU: Validiert vorhandene und neue Zeilen und bricht bei bereits vorhandener ID ab. Liefert eine kombinierte Liste; bestehende Fragen werden nicht ersetzt. */
export function mergeRows(existing, incoming) {
  buildPlan(existing.length ? existing : incoming);
  buildPlan(incoming);

  const existingIds = new Set(existing.map(row => row.id));

  for (const row of incoming) {
    if (existingIds.has(row.id)) {
      throw new Error(
        'Import abgebrochen: Frage-ID existiert bereits: ' + row.id
      );
    }
  }

  return [...existing, ...incoming];
}

/* DOKU: Liest den vorhandenen Katalog samt Inhaltspaketen, erstellt fehlende Dokumente und schaltet den Katalog transaktional um. Lernstandpfade werden nicht beschrieben. Paketanlage und Katalogwechsel sind getrennte Schritte: Bei Abbruch können unreferenzierte neue Pakete bestehen bleiben. */
export async function importPlan(db, incoming) {
  const ref = db.doc('privateContent/catalogue');
  const snapshot = await ref.get();
  const catalogue = snapshot.exists ? snapshot.data() : null;
  const existing = [];

  if (catalogue) {
    if (
      catalogue.schemaVersion !== 3 ||
      !Array.isArray(catalogue.packs) ||
      typeof catalogue.version !== 'string'
    ) {
      throw new Error(
        'Vorhandene Übersicht hat ein unbekanntes Format. Import abgebrochen.'
      );
    }

    const paths = new Set();

    for (const pack of catalogue.packs) {
      if (
        typeof pack.contentPath !== 'string' ||
        !/^Semester_[^/]+\/[^/]+\/[^/]+\/pack-[a-f0-9]{64}$/.test(pack.contentPath) ||
        typeof pack.metadataPath !== 'string' ||
        !/^Semester_[^/]+\/[^/]+\/[^/]+\/meta-[a-f0-9]{64}$/.test(pack.metadataPath) ||
        paths.has(pack.contentPath) ||
        paths.has(pack.metadataPath)
      ) {
        throw new Error(
          'Ungültiger oder doppelter Paketpfad in vorhandener Übersicht.'
        );
      }

      paths.add(pack.contentPath);
      paths.add(pack.metadataPath);

      const content = await db.doc(pack.contentPath).get();

      if (
        !content.exists ||
        !Array.isArray(content.data().questions) ||
        !content.data().questions.length
      ) {
        throw new Error(
          'Vorhandenes Fragenpaket fehlt oder ist leer: ' +
          pack.contentPath
        );
      }

      for (const question of content.data().questions) {
        const {id, path, ...data} = question;
        existing.push({id, path, data});
      }
    }
  }

  // Bei jeder vorhandenen Frage-ID abbrechen.
  const plan = buildPlan(mergeRows(existing, incoming));

  const oldPaths = new Set(
    (catalogue?.packs ?? []).flatMap(
      pack => [pack.contentPath, pack.metadataPath]
    )
  );

  // Bereits im Katalog enthaltene, unveränderte Pakete
  // dürfen weiterverwendet werden.
  const documents = plan.documents.filter(
    ([path]) => !oldPaths.has(path)
  );

  // Prüfen, ob neue Paketpfade bereits in Firestore existieren.
  for (const [path] of documents) {
    const document = await db.doc(path).get();

    if (document.exists) {
      throw new Error(
        'Import abgebrochen: Firestore-Dokument existiert bereits: ' +
        path
      );
    }
  }

  // Neue Dokumente ausschließlich anlegen, niemals überschreiben.
  for (let i = 0; i < documents.length; i += 200) {
    const batch = db.batch();

    for (const [path, data] of documents.slice(i, i + 200)) {
      batch.create(db.doc(path), data);
    }

    await batch.commit();
  }

  // Katalog nur aktualisieren, wenn er zwischenzeitlich
  // nicht durch einen anderen Vorgang verändert wurde.
  await db.runTransaction(async transaction => {
    const current = await transaction.get(ref);

    if (
      JSON.stringify(current.exists ? current.data() : null) !==
      JSON.stringify(catalogue)
    ) {
      throw new Error(
        'Die Fragenübersicht wurde zwischenzeitlich geändert. ' +
        'Bitte Import erneut starten.'
      );
    }

    if (catalogue?.version !== plan.version) {
      transaction.set(ref, {
        schemaVersion: 3,
        version: plan.version,
        packs: plan.packs
      });
    }
  });

  return plan;
}

/* DOKU: Prüft Argumente, Zielprojekt und Importdaten. Erst hinter --write werden Admin-Zugang und Firestore geladen; der Admin-Schlüssel muss zum Zielprojekt gehören. */
async function main() {
  const args = process.argv.slice(2);

  if (
    args.some(
      arg => arg.startsWith('--') && arg !== '--write'
    )
  ) {
    throw new Error(
      'Unbekannte Option. Erlaubt ist nur --write.'
    );
  }

  const files = args.filter(
    arg => !arg.startsWith('--')
  );

  if (!files.length) {
    console.log(
      'node tools/import-private.mjs C:\\Pfad\\fragen-export.json [--write]'
    );
    return;
  }

  if (files.length !== 1) {
    throw new Error(
      'Bitte genau eine Importdatei angeben.'
    );
  }

  const settings = JSON.parse(
    await readFile(
      new URL('../private-settings.json', import.meta.url),
      'utf8'
    )
  );

  const project = settings.firebaseConfig?.projectId;

  if (
    !project ||
    project === 'NEW_PROJECT_ID' ||
    project === 'example-original-project'
  ) {
    throw new Error(
      'Nur ein neues privates Zielprojekt ist erlaubt.'
    );
  }

  const exportData = JSON.parse(
    (await readFile(files[0], 'utf8')).replace(/^\uFEFF/, '')
  );

  const rows = Array.isArray(exportData)
    ? exportData
    : exportData.rows;

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(
      'Export enthält keine Fragen.'
    );
  }

  const incoming = buildPlan(rows);

  console.log(
    `${incoming.questions.length} Fragen, ` +
    `${incoming.packs.length} geschützte Inhalts-/Übersichtspakete. ` +
    `Ziel: ${project}.`
  );

  if (!args.includes('--write')) {
    console.log(
      'Nur lokal validiert. ' +
      'Es wurden keine Daten in Firestore verändert.'
    );
    return;
  }

  const credentialPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credentialPath) {
    throw new Error(
      'Admin-Zugang des NEUEN Projekts fehlt.'
    );
  }

  const key = JSON.parse(
    await readFile(credentialPath, 'utf8')
  );

  if (key.project_id !== project) {
    throw new Error(
      'Admin-Schlüssel gehört nicht zum Zielprojekt.'
    );
  }

  const {initializeApp, applicationDefault} =
    await import('firebase-admin/app');

  const {getFirestore} =
    await import('firebase-admin/firestore');

  initializeApp({
    credential: applicationDefault(),
    projectId: project
  });

  const plan = await importPlan(
    getFirestore(),
    rows
  );

  console.log(
    `Import abgeschlossen: insgesamt ${plan.questions.length} Fragen. ` +
    'Bestehende Fragen erhalten, Lernstände unverändert.'
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
