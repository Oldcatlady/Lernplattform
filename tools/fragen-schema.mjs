/* DOKU: Gemeinsames Import- und Testschema für deutsche Fragenfelder. Validierung verändert die übergebene Frage nicht und liefert Metadaten für die Paketplanung. */
// Deine deutschen Felder sind das verbindliche Speicherformat.
export const TYPES = ['MC', 'FC', 'BE', 'RF'];
/* DOKU: Liest die kommagetrennten Quizkennungen; validateQuestion prüft anschließend Gültigkeit und Eindeutigkeit. */
export function typesOf(q) {
  return String(q['Quiz-Möglichkeit'] ?? '').split(',').map(v => v.trim()).filter(Boolean);
}
/* DOKU: Vereinheitlicht Semesterbezeichnungen zu einer Pfadkennung und weist leere Werte, all und Schrägstriche zurück. */
export function semesterId(value) {
  const id = String(value ?? '').trim().replace(/^Semester[_\s]+/i, '').replace(/\.\s*Semester$/i, '');
  if (!id || id.includes('/') || id === 'all') throw new Error('Semester fehlt oder ist ungültig.');
  return id;
}
/* DOKU: Prüft Pflichttexte und modusspezifische Lösungen. RF darf nur allein vorkommen; MC/FC benötigen A bis D, BE mindestens eine Textvariante. */
export function validateQuestion(q) {
  const semester = semesterId(q.Semester);
  for (const field of ['Fach', 'Thema', 'Frage', 'Erklärung']) {
    if (typeof q[field] !== 'string' || !q[field].trim()) throw new Error(`${field} fehlt.`);
  }
  if ([q.Fach, q.Thema].some(v => v.includes('/') || v === 'all')) throw new Error('Fach/Thema dürfen keinen Schrägstrich enthalten.');
  const modes = typesOf(q);
  if (!modes.length || modes.some(v => !TYPES.includes(v)) || new Set(modes).size !== modes.length) throw new Error('Quiz-Möglichkeit ist ungültig.');
  if (modes.includes('RF') && modes.length !== 1) throw new Error('RF muss ein eigener Datensatz sein.');
  if (modes.includes('RF')) {
    if (!['Richtig', 'Falsch'].includes(q['Korrekte-Antwort'])) throw new Error('RF erwartet Richtig oder Falsch.');
  }
  if (modes.some(v => ['MC', 'FC'].includes(v))) {
    for (const letter of ['A', 'B', 'C', 'D']) {
      if (typeof q[`Antwortoption ${letter}`] !== 'string' || !q[`Antwortoption ${letter}`].trim()) throw new Error(`Antwortoption ${letter} fehlt.`);
    }
    const correct = String(q['Korrekte-Antwort'] ?? '').split(',').map(v => v.trim());
    if (!correct.length || correct.some(v => !['A','B','C','D'].includes(v)) || new Set(correct).size !== correct.length) throw new Error('Korrekte-Antwort erwartet A–D, kommagetrennt.');
  }
  if (modes.includes('BE')) {
    const entries = Array.isArray(q.Eingabe) ? q.Eingabe : [q.Eingabe];
    if (!entries.length || entries.some(v => typeof v !== 'string' || !v.trim())) throw new Error('BE erwartet eine Antwort in Eingabe (oder mehrere als Array).');
  }
  return {semester, subject: q.Fach, topic: q.Thema, types: modes};
}
/* DOKU: Fasst validierte Fragen-IDs nach Thema und Quizmodus zusammen; unterstützt die ältere Fachübersicht. */
export function metadataFor(rows) {
  const byTopic = {};
  for (const {id, data} of rows) {
    const meta = validateQuestion(data);
    const modes = byTopic[meta.topic] ??= {};
    for (const type of meta.types) (modes[type] ??= []).push(id);
  }
  return byTopic;
}
/* DOKU: Erzeugt kleine synthetische Testdatensätze zu den Quizmodi. Diese Funktion liest oder schreibt keine Datenbank. */
export function dummyQuestions(semester, subject, topic = 'Thema_1') {
  const common = {Semester: semester, Fach: subject, Thema: topic,
    'Antwortoption A': '', 'Antwortoption B': '', 'Antwortoption C': '', 'Antwortoption D': '',
    'Korrekte-Antwort': '', Eingabe: '', isTest: true, schemaVersion: 2};
  const mc = Array.from({length:4}, (_, i) => {
    const values = ['anderes Fach', 'anderes Semester', 'anderes Thema'];
    values.splice(i, 0, subject);
    const letters = ['A','B','C','D'];
    const q = {...common, 'Quiz-Möglichkeit': 'MC, FC',
      Frage: `Test ${i+1}: Welches Fach ist für diesen Datensatz eingetragen?`,
      ...Object.fromEntries(letters.map((letter,j) => [`Antwortoption ${letter}`, values[j]])),
      'Korrekte-Antwort': letters[i],
      Erklärung: `Dieser Datensatz gehört zu ${subject}, Semester ${semester}, ${topic}.`};
    if (i === 3) {
      q.Frage = 'Test 4: Welche Angaben passen zu diesem Datensatz? Wähle alle richtigen Antworten.';
      q['Antwortoption A'] = `Fach: ${subject}`;
      q['Antwortoption B'] = 'Semester: 99';
      q['Antwortoption C'] = `Thema: ${topic}`;
      q['Antwortoption D'] = `Semester: ${semester}`;
      q['Korrekte-Antwort'] = 'A,C,D';
    }
    return q;
  });
  const be = Array.from({length:4}, (_,i) => ({...common, 'Quiz-Möglichkeit':'BE',
    Frage: [`Wie heißt das Fach dieses Datensatzes?`, `Welche Semesternummer ist eingetragen?`,
      `Welche Themen-ID ist eingetragen?`, `Wie lautet die Kennung der Quizart Benutzereingabe?`][i],
    Eingabe: [subject, semester, topic, 'BE'][i],
    Erklärung: `Die erwartete Eingabe lautet: ${[subject,semester,topic,'BE'][i]}.`}));
  const rf = Array.from({length:4}, (_,i) => ({...common, 'Quiz-Möglichkeit':'RF',
    Frage: [`Das Fach dieses Datensatzes heißt ${subject}.`, 'Dieser Datensatz gehört zu Semester 99.',
      `Die Themen-ID lautet ${topic}.`, 'Dieser Datensatz ist eine Multiple-Choice-Frage.'][i],
    'Korrekte-Antwort': i%2===0 ? 'Richtig':'Falsch',
    Erklärung: `Fach: ${subject}; Semester: ${semester}; Thema: ${topic}; Quizart: RF.`}));
  return {mc, be, rf};
}
export const semesters = [
  {id:'1', subjects:['WiSo','Betriebssysteme Windows','Betriebssysteme Linux','Programmiertechnik','Datenbanken SQL','Webseiten','Digitaltechnik','Netzwerktechnik','Telekommunikation']},
  {id:'2', subjects:['Betriebssysteme Windows','Programmiertechnik','WiSo','Netzwerktechnik','Datenbanken SQL','Android','Docker','Telekommunikation']}
];
