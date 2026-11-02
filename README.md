# FIAE-Lernplattform

Eine persönliche Lernplattform für Multiple Choice, Flashcards, Texteingabe und Richtig/Falsch. Jede Person betreibt ihre eigene Instanz mit eigenem Firebase-Projekt, einem freigegebenen Konto und eigenen Fragen.

## Einstieg

1. [Einrichtung](docs/EINRICHTUNG.md): eigenes Firebase-Projekt, Konto, Konfiguration und Hosting einrichten.
2. [Platzhalter und Schlüssel](docs/PLATZHALTER-UND-SCHLUESSEL.md): alle selbst einzutragenden Werte und ihre Herkunft.
3. [Eigene Fragen](docs/EIGENE-FRAGEN.md): Datenformat und Import eigener Inhalte.

Die Vorlage enthält nur drei neu erstellte Beispieldatensätze. Persönliche Inhalte, Backups und Projektzugänge sind nicht enthalten. Die Dateien mit `.example` sind Vorlagen, keine funktionsfähige persönliche Konfiguration.

## Architektur

Firebase Hosting liefert HTML, CSS und JavaScript aus. Firebase Authentication meldet das eigene Konto an. Firestore speichert Fragenpakete, Übersichten und Lernstände. IndexedDB puffert Fragen und Antworten im Browser; gesammelte Antworten werden mit Firestore abgeglichen. Die Firebase-Browsermodule werden von gstatic.com geladen.

| Dateien | Aufgabe |
| --- | --- |
| quizBit.html | Dashboard mit Mehrfachfiltern, Quizart und Lernbedarf |
| mc.html / fc.html / be.html / quiz.html | Multiple Choice / Flashcards / Texteingabe / Richtig-Falsch |
| mixed.html | Zusätzlicher gemischter Quizablauf; im Dashboard derzeit nicht auswählbar |
| statistik.html | Bedarfsgruppen und zeitliche Frische |
| quiz-data-core.js / quiz-data.js | Filter, Rundenauswahl und Laden der Fragenpakete |
| private-auth.js | Kontoprüfung der Oberfläche |
| private-sync-core.js / private-sync.js | Lokale Antwortänderungen und Cloud-Abgleich |
| private-store.js | IndexedDB-Zugriff |
| firebase-config.js | Laden der persönlichen private-settings.json |
| header-global.html, footer-*, multi-select.*, theme-forest.css | Gemeinsame Oberflächenelemente |
| tools/ | Lokale Konfiguration, Fragenvorbereitung und Import |
| firestore.rules.template | Vorlage der serverseitigen Zugriffsregeln |

## Betriebsmodell

Die Anleitung bleibt beim kostenlosen Spark-Tarif und den vorhandenen Firebase-Diensten. Es werden keine zusätzlichen Server benötigt. Kostenlose Kontingente sind begrenzt; ein Minutenintervall ist kein garantierter Verbrauchsdeckel. Details stehen in der Einrichtung.

Eine lokal gesicherte Antwort kann noch auf den Cloud-Abgleich warten. Abmelden löscht den lokalen Cache nicht. Die Firestore-Regeln müssen im eigenen Projekt veröffentlicht werden; die lokale UID-Prüfung allein schützt die Datenbank nicht.

## Prüfung und bekannte Grenzen

[PRUEFUNG-UND-GRENZEN.md](docs/PRUEFUNG-UND-GRENZEN.md) beschreibt den Prüfstand und bekannte Einschränkungen. Historische projektgebundene Reparaturwerkzeuge sind nicht Teil dieser Vorlage.

## Lizenz

Die Projektlizenz wird von der Autorin noch festgelegt. Eine LICENSE-Datei folgt nach dieser Entscheidung. Vor öffentlicher Freigabe diesen Abschnitt entsprechend aktualisieren. Lizenzen der npm-Abhängigkeiten sind gesondert zu beachten.
