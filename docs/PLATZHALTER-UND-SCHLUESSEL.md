# Welche Angaben muss jeder selbst erstellen?

Alle Großbuchstabenwerte mit `_HERE` sowie `NEW_PROJECT_ID` sind sichtbar markierte Platzhalter. Sie werden durch Werte aus dem eigenen Firebase-Projekt ersetzt. Keine Daten einer anderen Person übernehmen.

## Werte und Herkunft

| Angabe | Platzhalter | Woher? | Wohin? |
| --- | --- | --- | --- |
| Firebase-Projekt-ID | NEW_PROJECT_ID | Firebase-Konsole → Projekteinstellungen → Allgemein → Projekt-ID | private-settings.json → firebaseConfig.projectId; nach Konfiguration auch .firebaserc |
| Web-API-Key | API_KEY_HERE | Webkonfiguration der eigenen registrierten Firebase-Web-App | private-settings.json → firebaseConfig.apiKey |
| Auth-Domain | AUTH_DOMAIN_HERE | Dieselbe Webkonfiguration; genauen Wert kopieren | private-settings.json → firebaseConfig.authDomain |
| Web-App-ID | APP_ID_HERE | Dieselbe Webkonfiguration | private-settings.json → firebaseConfig.appId |
| Messaging-Sender-ID | MESSAGING_SENDER_ID_HERE | Dieselbe Webkonfiguration | private-settings.json → firebaseConfig.messagingSenderId |
| Storage-Bucket-Angabe | STORAGE_BUCKET_HERE | Falls im Konfigurationsobjekt vorhanden, unverändert übernehmen | private-settings.json → firebaseConfig.storageBucket; sonst dieses Feld entfernen |
| UID des einzigen freigegebenen Kontos | OWNER_UID_HERE | Authentication → Users/Nutzer → selbst angelegtes Konto → UID | private-settings.json → ownerUid; configure-private.mjs setzt sie anschließend in firestore.rules ein |
| Hosting-Site-ID | HOSTING_SITE_ID_HERE | Hosting-Konsole oder firebase hosting:sites:list --project EIGENE_PROJEKT_ID | firebase.json → hosting.site |
| Login-E-Mail und Passwort | Keine Platzhalter im Code | Bei Authentication → Nutzer hinzufügen selbst festlegen | Nur ins Loginformular; nicht in Projektdateien eintragen |
| Admin-Zugangsdatei | Kein Schlüssel im Repository | Projekteinstellungen → Dienstkonten → neuer privater Schlüssel, falls für den Import verwendet | Ausschließlich außerhalb des Repositorys speichern; Pfad über GOOGLE_APPLICATION_CREDENTIALS setzen |
| Eigene Fragen | Beispielfragen vorhanden | Selbst verfassen oder Inhalte mit passenden Nutzungsrechten verwenden | private-data/fragen.json, anschließend vorbereiten/importieren |

## Drei verschiedene Zugänge

**Google-Konto:** Verwaltet das eigene Firebase-Projekt und meldet die Firebase CLI an. Es ist nicht automatisch das Lernkonto.

**Authentication-Konto:** E-Mail/Passwort-Konto in genau diesem Firebase-Projekt. Seine UID wird freigegeben. Das ist die Anmeldung an der Lernplattform.

**Admin-Zugang:** Berechtigt das lokale Importwerkzeug zur Datenverwaltung. Der private Schlüssel gehört niemals in HTML, JavaScript, private-settings.json oder einen Upload. Die Browseranwendung benötigt ihn nicht.

## Webkonfiguration ist browserlesbar

Der Web-API-Key identifiziert die Firebase-App. Er ist kein Admin-Schlüssel. Der bestehende Code lädt private-settings.json öffentlich über Hosting; die individuellen Werte sind daher im Browser sichtbar. Die GitHub-Vorlage liefert trotzdem neutrale Platzhalter, damit niemand das Projekt der Autorin übernimmt. Firestore Security Rules und gegebenenfalls API-Beschränkungen sind eigenständige Schutzmechanismen.

Wenn ein geheimer Admin-Schlüssel versehentlich veröffentlicht wurde, genügt eine spätere Löschung aus der aktuellen Datei nicht: Der Schlüssel ist zu widerrufen und die Veröffentlichung einschließlich Git-Historie zu behandeln.

## Was hier nicht zusätzlich benötigt wird

- Keine selbst zu programmierende API: Die Anwendung verwendet Firebase-SDKs.
- Kein separater Webserver und keine Cloud Function.
- Keine OpenAI-, Gemini- oder sonstigen KI-API-Keys.
- Kein Cloud-Storage-Upload: Die Anwendung nutzt Firestore für Fragen. Ein vorhandenes storageBucket-Feld bedeutet nicht, dass Storage aktiviert werden muss.
- Kein eigener reCAPTCHA-Site-Key in dieser Codefassung. App Check/reCAPTCHA ist hier nicht integriert. Allein einen Schlüssel anzulegen würde keine Integration herstellen.

`example-original-project` ist eine synthetische, reservierte Beispielkennung in den vorhandenen Projektprüfungen und Tests. Sie ist kein weiterer einzutragender Wert.

Quelle zur Webkonfiguration und API-Key-Abgrenzung: [Firebase – API keys](https://firebase.google.com/docs/projects/api-keys).
