# Eigene Fragen erstellen und importieren

Jede Person erstellt ihre eigenen Lerninhalte. Die Datei examples/fragen.example.json enthält drei neue, allgemeine Beispieldatensätze: einen für MC und FC, einen für BE und einen für RF. Sie enthält keine Fragen aus dem privaten Bestand der Autorin.

## 1. Private Arbeitsdatei anlegen

Im Projektstamm in PowerShell:

```powershell
New-Item -ItemType Directory -Force .\private-data
Copy-Item .\examples\fragen.example.json .\private-data\fragen.json
```

Die Datei private-data/fragen.json bearbeiten und eigene Fragen eintragen. Der gesamte Ordner private-data ist sowohl von Git als auch von Firebase Hosting ausgeschlossen. Der Beispieleordner selbst wird ebenfalls nicht auf Hosting ausgeliefert.

## 2. Fragenformat

Die Quelldatei ist ein JSON-Array. Jede Frage benötigt Semester, Fach, Thema, Quiz-Möglichkeit, Frage und Erklärung. Die Feldnamen mit Umlauten und Bindestrichen exakt beibehalten.

| Feld | Inhalt |
| --- | --- |
| Semester | Textkennung, beispielsweise "1" |
| Fach | Eigenes Fach, beispielsweise "Programmiertechnik" |
| Thema | Eigenes Thema; keine Schrägstriche |
| Quiz-Möglichkeit | "MC", "FC", "MC, FC", "BE" oder "RF" |
| Frage | Nichtleerer Fragetext |
| Erklärung | Nichtleere Erklärung |
| Antwortoption A bis D | Für MC/FC vier nichtleere Antworttexte |
| Korrekte-Antwort | Für MC/FC Buchstaben, beispielsweise "B" oder "A,C"; für RF exakt "Richtig" oder "Falsch" |
| Eingabe | Für BE Antworttext oder Liste erlaubter Texte |

RF muss ein eigener Datensatz sein und darf nicht mit anderen Modi kombiniert werden. Fach/Thema dürfen weder `/` enthalten noch `all` heißen. Die Rohquelle enthält noch keine id-, path- oder data-Felder.

BE in be.html vergleicht nach Unicode-Vereinheitlichung ohne Groß-/Kleinschreibung, Leerraum und Bindestriche; es gibt keine allgemeine Rechtschreibkorrektur. Hinterlegte Varianten müssen fachlich passen.

## 3. Importdatei erzeugen

```powershell
node .\tools\prepare-private-import.mjs .\private-data\fragen.json .\private-data\fragen-import.json
```

Dieses lokale Werkzeug validiert die Fragen, vergibt UUIDs und erstellt das Importformat `{id,path,data}`. Es überschreibt keine vorhandene Ausgabedatei. Bereits vorbereitete Importzeilen nicht erneut als Rohquelle verwenden.

Für einen späteren Satz neuer Fragen neue Dateinamen verwenden, etwa fragen-02.json und fragen-02-import.json. Dieselbe Frage wiederholt mit neuen IDs vorzubereiten erzeugt fachliche Duplikate; die Prüfung erkennt doppelte Fragetexte innerhalb einer Quelldatei, nicht über alle früheren Importe hinweg.

## 4. Lokal validieren

Die persönliche private-settings.json muss bereits ausgefüllt sein:

```powershell
node .\tools\import-private.mjs .\private-data\fragen-import.json
```

Ohne --write wird nur die Eingabe lokal geprüft. Die Ausgabe nennt das Zielprojekt und die Paketanzahl. Das ist noch kein Vergleich gegen den vorhandenen Cloud-Bestand.

## 5. Admin-Zugang für den Import einrichten

In der eigenen Firebase-Konsole unter **Projekteinstellungen → Dienstkonten → Firebase Admin SDK** bei Bedarf einen privaten Schlüssel erzeugen. Falls die Organisation die Schlüsselerstellung sperrt, diese Sperre nicht umgehen; ein zulässiger Admin-Zugang muss dann mit der Projektverwaltung geklärt werden.

Die heruntergeladene JSON-Datei beispielsweise unter `C:\Firebase-Schluessel\mein-admin.json` speichern – außerhalb des Repositorys und des Hostingordners. Die Datei enthält einen geheimen privaten Schlüssel. Keine Werte daraus in private-settings.json übertragen.

In der aktuellen PowerShell-Sitzung den tatsächlichen Dateipfad setzen:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\Firebase-Schluessel\mein-admin.json'
```

Der Import prüft, ob der Schlüssel zum in private-settings.json gewählten Projekt gehört. Admin-Zugriff wird über administrative Berechtigungen gesteuert und nicht durch die Browser-Owner-Regeln beschränkt.

## 6. Bewusst importieren

Wenn lokale Prüfung und Zielprojekt stimmen:

```powershell
node .\tools\import-private.mjs .\private-data\fragen-import.json --write
```

Der vorhandene Import ergänzt neue Fragen und aktualisiert die Paketübersicht. Er bearbeitet keine Lernstände. Bereits vorhandene IDs werden abgelehnt; eine unveränderte Datei ist daher nicht als beliebig wiederholbarer Import vorgesehen. Dieses Werkzeug ist kein Bearbeitungs- oder Löschwerkzeug für bestehende Fragen.

Bei einem Abbruch können bereits angelegte, aber noch nicht vom Katalog verwendete Paketdokumente bestehen bleiben. Fehlermeldungen prüfen, statt dieselben Inhalte erneut mit neuen IDs anzulegen.

Nach dem Import die Lernplattform erneut öffnen. Die Inhaltsübersicht wird bis zu fünf Minuten lokal zwischengespeichert; Änderungen können deshalb verzögert erscheinen.

Für spätere neue Fragen ist kein Hosting-Deployment erforderlich, solange nur Firestore-Inhalte ergänzt wurden.

## Schlüssel nach der Arbeit

Die Umgebungsvariable kann für diese Shell wieder entfernt werden:

```powershell
Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS
```

Das widerruft den Schlüssel nicht und löscht auch nicht die Datei. Der private Schlüssel muss geschützt bleiben; wenn er nicht mehr benötigt wird, kann er in der Konsole widerrufen werden. Für die Nutzung der Lernplattform wird er nicht benötigt.

Quelle: [Firebase Admin SDK einrichten](https://firebase.google.com/docs/admin/setup).
