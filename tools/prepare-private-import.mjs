
/* DOKU: Lokales Vorbereitungswerkzeug: validiert neue Rohfragen, vergibt UUIDs und erstellt eine neue Importdatei. Baut keine Verbindung zu Firestore auf. */
import {readFile, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {validateQuestion} from './fragen-schema.mjs';
import {buildPlan} from './private-content-plan.mjs';

/* DOKU: Erwartet unterschiedliche Quell- und Zieldateien. Verhindert erneute ID-Vergabe und doppelte Fragetexte innerhalb desselben Themas; flag wx schützt eine vorhandene Zieldatei vor Überschreiben. */
async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    throw new Error(
      'Aufruf: node tools/prepare-private-import.mjs QUELLE.json IMPORT.json'
    );
  }

  const [sourceFile, outputFile] = args;

  if (resolve(sourceFile) === resolve(outputFile)) {
    throw new Error(
      'Quelldatei und Zieldatei müssen unterschiedlich sein.'
    );
  }

  const sourceText = (
    await readFile(sourceFile, 'utf8')
  ).replace(/^\uFEFF/, '');

  const parsed = JSON.parse(sourceText);

  const questions = Array.isArray(parsed)
    ? parsed
    : parsed?.rows;

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error(
      'Die Quelldatei muss ein nichtleeres Fragenarray enthalten.'
    );
  }

  const rows = [];
  const summaries = new Map();
  const seen = new Set();

  for (let index = 0; index < questions.length; index++) {
    const source = questions[index];

    if (
      !source ||
      typeof source !== 'object' ||
      Array.isArray(source)
    ) {
      throw new Error(
        `Frage ${index + 1}: Ungültiges Objekt.`
      );
    }

    // Bereits vorbereitete Fragen nicht erneut mit IDs versehen.
    if (
      Object.hasOwn(source, 'id') ||
      Object.hasOwn(source, 'path') ||
      Object.hasOwn(source, 'data')
    ) {
      throw new Error(
        `Frage ${index + 1}: id/path/data bereits vorhanden. ` +
        'Keine erneute ID-Vergabe erlaubt.'
      );
    }

    // Vorhandenes Projektschema verwenden.
    const meta = validateQuestion(source);

    if (
      typeof source.Frage !== 'string' ||
      !source.Frage.trim()
    ) {
      throw new Error(
        `Frage ${index + 1}: Fragetext fehlt.`
      );
    }

    const signature = JSON.stringify([
      meta.semester,
      meta.subject,
      meta.topic,
      source.Frage.trim().toLocaleLowerCase('de-DE')
    ]);

    if (seen.has(signature)) {
      throw new Error(
        `Frage ${index + 1}: Doppelte Frage innerhalb desselben Themas.`
      );
    }

    seen.add(signature);

    const id = randomUUID();

    const path =
      `Semester_${meta.semester}/${meta.subject}/${meta.topic}/${id}`;

    rows.push({
      id,
      path,
      data: source
    });

    const group =
      `${meta.semester} | ${meta.subject} | ${meta.topic}`;

    summaries.set(
      group,
      (summaries.get(group) ?? 0) + 1
    );
  }

  // Dieselbe technische Validierung wie beim Import.
  const plan = buildPlan(rows);

  // Ausschließlich neue Dateien anlegen.
  // Eine vorhandene Importdatei niemals überschreiben.
  await writeFile(
    outputFile,
    JSON.stringify(rows, null, 2) + '\n',
    {
      encoding: 'utf8',
      flag: 'wx'
    }
  );

  console.log(`Importdatei erstellt: ${outputFile}`);
  console.log(`Fragen: ${plan.questions.length}`);
  console.log(`Pakete: ${plan.packs.length}`);
  console.log('Zuordnung:');

  for (const [group, count] of summaries) {
    console.log(`  ${group}: ${count}`);
  }

  console.log(
    'Nur lokal vorbereitet. Keine Firestore-Verbindung hergestellt.'
  );
}

main().catch(error => {
  console.error(
    'Vorbereitung fehlgeschlagen:',
    error.message
  );
  process.exitCode = 1;
});
