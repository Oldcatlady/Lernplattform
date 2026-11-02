/* DOKU: Reine Auswahl- und Statistikhelfer ohne Firebase-Zugriff. Dashboard und Quizseiten teilen sich dadurch Filter und Beschriftungen. */
// Gemeinsame Funktionen ohne Datenbankzugriff.
/* DOKU: MC = Multiple Choice, FC = Flashcards, BE = Benutzereingabe, RF = Richtig/Falsch. */
export const QUIZ_TYPES = ['MC', 'FC', 'BE', 'RF'];
/* DOKU: Eingabe: Rohdatensatz mit deutschen oder vereinheitlichten Quizfeldern. Ergebnis: eindeutige Liste der unterstützten Typkennungen; unbekannte Werte entfallen. */
export function quizTypes(raw) {
    const value = raw['Quiz-Möglichkeit'] ?? raw.quizTypes ?? raw.quizType ?? '';
    return [...new Set((Array.isArray(value) ? value : String(value).split(','))
        .map(type => String(type).trim()).filter(type => QUIZ_TYPES.includes(type)))];
}
/* DOKU: Eingabe: Frage und Auswahl mit semester/subject/topic. Jede Ebene muss gesetzt sein. Akzeptiert Einzelwerte, Listen oder all; vergleicht als Text. */
export function matchesFilters(q, selection) {
    return ['semester', 'subject', 'topic'].every(key =>
        selection[key] && (selection[key] === 'all' || (Array.isArray(selection[key]) ? selection[key].map(String).includes(String(q[key])) : String(q[key]) === String(selection[key]))));
}
/* DOKU: Wandelt ältere Fachübersichten in eindeutige Fragenreferenzen um. Mehrere Quizarten einer Frage werden zusammengeführt; gleiche ID an unterschiedlichen Pfaden löst einen Fehler aus. Der aktuelle Datenlader nutzt stattdessen Paketmetadaten. */
export function inventoryFromSubjects(subjects) {
    const rows = new Map();
    const idPaths = new Map();
    for (const subject of subjects) {
        const semester = subject.semester;
        const name = subject.name || subject.documentId;
        // Die v1-Teststruktur enthält nur testQuestionIdsByTopic.
        const topics = subject.questionIdsByTopic ?? subject.testQuestionIdsByTopic;
        if (!topics || typeof topics !== 'object') {
            throw new Error(`Fragenübersicht fehlt für ${name}. Importübersicht aktualisieren.`);
        }
        for (const [topic, modes] of Object.entries(topics)) {
            if (!topic || topic.includes('/')) throw new Error('Ungültige Themen-ID.');
            for (const [type, value] of Object.entries(modes)) {
                if (!QUIZ_TYPES.includes(type)) continue;
                const ids = Array.isArray(value) ? value : [value];
                for (const id of ids) {
                    if (typeof id !== 'string' || !id || id.includes('/')) throw new Error('Ungültige Frage-ID.');
                    const path = `Semester_${semester}/${subject.documentId}/${topic}/${id}`;
                    // Statistik-IDs sind Firestore-Auto-IDs. Keine stillen Kollisionen.
                    if (idPaths.has(id) && idPaths.get(id) !== path) throw new Error('Doppelte Frage-ID in unterschiedlichen Themen.');
                    idPaths.set(id, path);
                    if (!rows.has(path)) rows.set(path, {id, path, semester, subject: name, topic, quizTypes: []});
                    const row = rows.get(path);
                    if (!row.quizTypes.includes(type)) row.quizTypes.push(type);
                }
            }
        }
    }
    return [...rows.values()];
}
/* DOKU: Erzeugt neue, voneinander unabhängige ID-Listen. falsch und gesehen sind zusätzliche Sichten; die Bedarfsgruppen werden getrennt befüllt. */
export function emptyPools() {
    return { neu: [], falsch: [], gesehen: [], hoch: [], medium: [], gering: [] };
}
/* DOKU: Eingabe: Fragenreferenzen, Map der Lernstände und Quiztyp. FC: 0 Ansichten = neu, 1 = hoch, 2 = medium, ab 3 = gering. Andere Typen: noch nie beantwortet = neu; sonst Erfolgsquote bis 30 % = hoch, bis 65 % = medium, darüber gering. Eine früher falsche Frage kann zusätzlich in falsch liegen. */
export function buildPools(questions, stats, type) {
    const pools = emptyPools();
    for (const q of questions) {
        const st = stats.get(q.id);
        if (type === 'FC') {
            const views = st?.timesViewed || 0;
            pools[views === 0 ? 'neu' : views === 1 ? 'hoch' : views === 2 ? 'medium' : 'gering'].push(q.id);
            continue;
        }
        if (st?.timesViewed > 0) pools.gesehen.push(q.id);
        if (!(st?.timesPlayed > 0)) {
            pools.neu.push(q.id);
        } else {
            if ((st.timesWrong || 0) > 0) pools.falsch.push(q.id);
            const percent = 100 * Math.max(0, st.timesPlayed - (st.timesWrong || 0)) / st.timesPlayed;
            pools[percent <= 30 ? 'hoch' : percent <= 65 ? 'medium' : 'gering'].push(q.id);
        }
    }
    return pools;
}
/* DOKU: Fisher-Yates-Mischung auf einer Kopie: Das übergebene Array bleibt erhalten. Math.random dient hier der Lernreihenfolge, nicht kryptografischen Zwecken. */
export function shuffle(items) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/* DOKU: Liefert bis count IDs oder bei all alle verfügbaren. gemischt entnimmt reihum aus neu/hoch/medium/gering und mischt erneut. type wird im Funktionskörper nicht verwendet; die Pools müssen zuvor passend aufgebaut sein. Hier erfolgt keine Entdoppelung beliebiger Eingabepools. */
export function chooseIds(pools, category, count, type) {
    if (category !== 'gemischt') return shuffle(pools[category] || []).slice(0, count === 'all' ? undefined : count);
    const queues = ['neu', 'hoch', 'medium', 'gering']
        .map(key => shuffle(pools[key])).filter(pool => pool.length);
    const result = [];
    const limit = count === 'all' ? queues.reduce((sum, pool) => sum + pool.length, 0) : count;
    while (result.length < limit && queues.some(pool => pool.length)) {
        for (const pool of queues) if (pool.length && result.length < limit) result.push(pool.pop());
    }
    return shuffle(result);
}

/* DOKU: Liest quizSelection aus dem tabbezogenen sessionStorage. Fehlendes oder ungültiges JSON ergibt null; die fachliche Prüfung übernimmt die aufrufende Seite bzw. loadRoundQuestions. */
export function readQuizSelection() {
    try {
        const selection = JSON.parse(sessionStorage.getItem('quizSelection') || 'null');
        return selection && typeof selection === 'object' ? selection : null;
    } catch { return null; }
}

// Stabile Verteilung: 128 kleine Dokumente je Konto, eigene Daten je Frage-ID.
/* DOKU: Berechnet aus einer ID einen stabilen Hash und einen von 128 Schlüsseln. Nicht mit shardKey aus private-sync-core.js verwechseln: Die aktuelle Synchronisation verwendet dort 16 Dokumente. */
export function statsShardKey(id) {
    let hash = 2166136261;
    for (const character of id) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return 's' + ((hash >>> 0) % 128).toString().padStart(3, '0');
}

/* DOKU: Formatiert Einzelwerte, Mehrfachauswahlen oder all für Überschriften; Semester erhalten eine lesbare Bezeichnung. */
export function selectionLabel(value, field) {
    if (value === 'all') return {semester: 'Alle Semester', subject: 'Alle Fächer', topic: 'Alle Themen'}[field];
    const values = Array.isArray(value) ? value : [value];
    return values.map(v => field === 'semester' ? (v === 'extra' ? 'Extra' : `${v}. Semester`) : v).join(', ');
}
