# Vor der öffentlichen Freigabe

## Noch festzulegen

Die Autorin entscheidet über die Projektlizenz. Anschließend eine passende LICENSE-Datei ergänzen und den offenen Lizenzabschnitt in README.md aktualisieren. Die hier vorhandenen Abhängigkeitsbeschreibungen ersetzen keine Lizenz für den eigenen Code.

## Was in das Repository gehört

Den Inhalt des Ordners FIAE-Lernplattform übernehmen. Die außerhalb dieses Ordners liegende Übergabeübersicht ist für die Autorin bestimmt. Nicht das frühere private Gesamtpaket oder ein komplettes Arbeitsverzeichnis zusätzlich hochladen.

Die Vorlage enthält bewusst keine fertig ausgefüllte private-settings.json, keine .firebaserc und keine auf eine echte UID zugeschnittene firestore.rules. Diese Dateien werden lokal bei der Einrichtung erstellt. Die neutralen Beispieldateien und die Regelvorlage bleiben im Repository.

## Nach einem eigenen Einrichtungstest

Persönliche Dateien und private-data sind ignoriert. Der individuelle Hosting-Site-Wert in firebase.json ist dagegen nicht automatisch ignoriert: vor einem Commit dort wieder HOSTING_SITE_ID_HERE einsetzen. Keine geheimen Schlüssel im Projektordner ablegen.

Bei Verwendung von Git können vor dem Commit die vorgemerkten Pfade geprüft werden:

```powershell
git status --short
git diff --cached --name-only
```

.gitignore entfernt keine früheren Commits. Diese ZIP enthält keine Git-Historie; bei Übernahme in ein bereits vorhandenes Repository muss dessen bisherige Historie separat betrachtet werden.

## Sinnvolle kurze Abschlusskontrolle

- Lizenz festgelegt und README angepasst.
- private-settings.example.json und firebase.json enthalten weiterhin markierte Platzhalter.
- Keine eigenen Fragen, Backups oder Zugangsdaten hinzugefügt.
- README und Einrichtung einmal aus Sicht einer neuen Person gelesen.
- Für eine spätere Zusage „auf einem neuen Firebase-Projekt erprobt“ den vollständigen Ablauf in einer eigenen Testinstanz prüfen; bislang wurden die unten dokumentierten lokalen Kontrollen durchgeführt.
