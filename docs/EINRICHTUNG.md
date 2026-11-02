# Eigene Lernplattform einrichten

Diese Anleitung richtet eine unabhängige Instanz für eine Person ein. Alle Arbeiten erfolgen im eigenen Firebase-Projekt. Die Anleitung ist für Windows/PowerShell formuliert; die Node- und Firebase-Befehle selbst funktionieren auch auf anderen unterstützten Systemen.

## 1. Voraussetzungen

- Eigenes Google-Konto für die Firebase-Konsole.
- Eine gepflegte Node.js-LTS-Version mit npm, beispielsweise Node.js 22 oder 24. Download: [nodejs.org](https://nodejs.org/).
- Entpackte Projektdateien in einem eigenen Ordner.

PowerShell im Projektordner öffnen – dort liegen README.md und firebase.json. Versionen prüfen und Werkzeuge installieren:

```powershell
node --version
npm --version
npm ci --prefix .\tools
npm install -g firebase-tools
firebase login
```

npm ci installiert die bereits beschriebenen Verwaltungsabhängigkeiten unter tools/node_modules. firebase login öffnet die Anmeldung für das verwaltende Google-Konto.

## 2. Firebase-Projekt anlegen

In der [Firebase-Konsole](https://console.firebase.google.com/) ein eigenes Projekt erstellen. Die echte Projekt-ID notieren; Anzeigename und Projekt-ID können verschieden sein. Für diesen Aufbau den kostenlosen **Spark-Tarif** verwenden und keine Abrechnung für zusätzliche Dienste verknüpfen. Google Analytics wird von der Plattform nicht benötigt und kann beim Anlegen abgewählt bleiben.

Firebase hat Nutzungslimits. Bei ausgeschöpften kostenlosen Kontingenten können Funktionen eingeschränkt werden. Diese Anleitung ist keine Zusage unbegrenzter kostenloser Nutzung.

## 3. Firestore-Datenbank erstellen

Unter **Build → Firestore Database** eine Datenbank anlegen:

1. Die Standard-/Native-Firestore-Datenbank wählen, nicht eine MongoDB-kompatible Enterprise-Datenbank.
2. Die Datenbank-ID **(default)** verwenden. Die vorhandenen Lader verwenden diese Standarddatenbank.
3. Einen passenden Standort wählen, etwa eine angebotene EU-Region. Die Standortwahl ist langfristig relevant; die Auswahl einer EU-Region sagt allein nichts über sämtliche anderen Firebase-Dienste aus.
4. Mit gesperrten Produktionsregeln starten. Später werden die mitgelieferten, auf die eigene UID zugeschnittenen Regeln veröffentlicht.

Die Sammlungen müssen nicht von Hand angelegt werden. Der spätere Fragenimport erstellt Katalog und Pakete; Lernstände entstehen beim Lernen.

## 4. Eigenes Login-Konto anlegen

Unter **Build → Authentication** die Anmeldung **E-Mail/Passwort** aktivieren. Gemeint ist die Anmeldung mit Passwort, nicht ausschließlich die Anmeldung per E-Mail-Link.

Unter **Users/Nutzer → Nutzer hinzufügen** das eigene Lernkonto mit E-Mail und Passwort anlegen. Anschließend dessen **UID** kopieren. Sie ist weder die E-Mail-Adresse noch die Projekt-ID.

Die Anwendung bietet kein Registrierungsformular. Ihre Regeln lassen nur die eingetragene UID zu. Das Fehlen eines Registrierungsformulars ist keine Garantie, dass Auth-Kontoanlage über andere Schnittstellen deaktiviert ist; solche Konten erhalten durch die Owner-Regeln keinen Zugriff auf die Lerninhalte.

## 5. Web-App registrieren

Unter **Projekteinstellungen → Allgemein → Deine Apps** eine Web-App über das Websymbol registrieren. Einen selbst gewählten App-Namen verwenden. Das angezeigte firebaseConfig-Objekt kopieren.

Diese Vorlage verwendet bereits Firebase-Module; den von der Konsole vorgeschlagenen JavaScript-Initialisierungscode nicht zusätzlich in die HTML-Seiten einfügen. Benötigt werden nur die Konfigurationswerte.

## 6. Lokale Konfiguration ausfüllen

Die Vorlage kopieren:

```powershell
Copy-Item .\private-settings.example.json .\private-settings.json
```

In private-settings.json:

- `OWNER_UID_HERE` durch die UID aus Schritt 4 ersetzen.
- Das Objekt unter `firebaseConfig` durch die Webkonfiguration aus Schritt 5 ersetzen.
- JSON beibehalten: doppelte Anführungszeichen, kein `const firebaseConfig =`, keine Kommentare und kein Semikolon nach dem Objekt.
- Alle Felder mit `_HERE` und `NEW_PROJECT_ID` ersetzen; wenn storageBucket im eigenen Konfigurationsobjekt fehlt, dieses optionale Feld weglassen.

Anschließend:

```powershell
node .\tools\configure-private.mjs
```

Das vorhandene Werkzeug erzeugt lokal **firestore.rules** aus der UID-Vorlage und **.firebaserc** aus der Projekt-ID. Diese beiden erzeugten Dateien sowie private-settings.json werden von .gitignore ausgeschlossen. Die Vorlage firestore.rules.template wird nicht ausgefüllt oder ersetzt; sie bleibt neutral.

Nach späterem Ändern der UID muss configure-private.mjs erneut laufen, damit Kontoprüfung und Regeldatei dieselbe UID verwenden.

## 7. Hosting-Site bestimmen

In der Hosting-Konsole die eigene Site einrichten bzw. deren Site-ID nachsehen. Alternativ zeigt die CLI vorhandene Sites:

```powershell
$projektId = 'DEINE_ECHTE_PROJEKT_ID'
firebase hosting:sites:list --project $projektId
```

`DEINE_ECHTE_PROJEKT_ID` im Befehl vorher durch die tatsächliche Projekt-ID ersetzen. Wenn noch keine Site besteht, zuerst in der Hosting-Konsole die Site anlegen.

In **firebase.json → hosting.site** `HOSTING_SITE_ID_HERE` durch die tatsächliche Site-ID ersetzen. Die Site-ID nicht aus der Projekt-ID erraten: Laut aktueller Firebase-Dokumentation kann die Standardsite seit Oktober 2026 auch eine abweichende Kennung erhalten. Die Hosting-URL enthält die Site-ID.

Die vorhandene firebase.json ist bereits vorbereitet. Ein erneutes firebase init ist für diesen Dateibaum nicht nötig; es könnte vorhandene Konfigurationen überschreiben. firebase.json enthält keine Admin-Zugänge. Wer am öffentlichen Repository mitarbeitet, trägt den lokalen Site-Wert vor einem Commit wieder auf den Platzhalter zurück.

## 8. Eigene Fragen vorbereiten und importieren

Die vollständigen Schritte und das Format stehen in [EIGENE-FRAGEN.md](EIGENE-FRAGEN.md). Für den ersten Durchlauf können die drei ausdrücklich synthetischen Beispieldatensätze verwendet werden.

Der Import benötigt einen lokalen Admin-Zugang; die Browser-App benötigt ihn nicht. Schlüssel und privater Importbestand bleiben auf dem eigenen Rechner.

## 9. Regeln, Indizes und Hosting veröffentlichen

Vorher müssen die persönliche Konfiguration, die erzeugten Regeln, die echte Hosting-Site-ID und ein erfolgreicher Fragenimport vorhanden sein. Die folgende Variable muss die echte Projekt-ID enthalten:

```powershell
$projektId = 'DEINE_ECHTE_PROJEKT_ID'
firebase deploy --only "firestore:rules,firestore:indexes,hosting" --project $projektId
```

Die Angabe von firestore:rules ist wichtig: Ein reines Hosting-Deployment übernimmt keine neuen Datenbankregeln. Die CLI gibt die Hosting-URL aus.

In Authentication → Settings/Einstellungen → Authorized domains/autorisierte Domains prüfen, dass die verwendete Hosting-Domain erlaubt ist. Eine eigene Domain ist optional; sie wird für den Einstieg nicht benötigt.

## 10. Kurzer Funktionstest

1. Hosting-URL öffnen und mit dem selbst angelegten Authentication-Konto anmelden.
2. Beispielsemester, Beispielfach und Thema wählen; einen Quiztyp und eine Lernkategorie auswählen.
3. Eine Antwort geben bzw. eine Flashcard aufdecken und anschließend die Statistik ansehen.
4. Für den Gerätewechsel die Seite zunächst aktiv geöffnet lassen, damit der Minutenabgleich erfolgen kann. Die Vorlage hat keinen sichtbaren „Jetzt synchronisieren“-Button. Beim Abmelden wird zusätzlich ein letzter Abgleich versucht.
5. Auf einem zweiten eigenen Gerät anmelden und den Lernstand vergleichen. Hintergrundtabs können Timer verzögern; eine lokal bestätigte Antwort ist nicht automatisch bereits in der Cloud angekommen.

## Häufige Ursachen für Einrichtungsfehler

| Meldung/Situation | Prüfen |
| --- | --- |
| private-settings.json fehlt | Beispiel in genau diesen Dateinamen kopiert? Datei im Projektstamm und beim Hosting vorhanden? |
| Bitte zuerst … Konfiguration eintragen | UID/Projekt-ID noch Platzhalter? Richtige JSON-Datei bearbeitet? |
| Keine Daten oder fehlende Berechtigung | Konto-UID und generierte Regeln gleich? Regeln im richtigen Projekt veröffentlicht? |
| Fragenübersicht/Katalog fehlt | Fragenimport bereits mit --write ins eigene Projekt abgeschlossen? |
| Hosting-Site nicht gefunden | Tatsächliche Site-ID eingetragen und richtige Projekt-ID im CLI-Befehl? |
| Datei öffnet sich, Anmeldung funktioniert nicht | Die App über Hosting bzw. einen lokalen HTTP-Server öffnen, nicht per file://. Bei lokalem Test gegebenenfalls localhost als autorisierte Domain ergänzen. |
| Lernstand auf zweitem Gerät fehlt | Abgleich auf dem ersten Gerät abgeschlossen? Minute abgewartet und Seite auf zweitem Gerät erneut geöffnet? |

## Offizielle Quellen

Stand der Prüfung: 2. November 2026. Konsolenbezeichnungen können sich ändern.

- [Firebase CLI](https://firebase.google.com/docs/cli)
- [Web-App einrichten](https://firebase.google.com/docs/web/setup)
- [E-Mail/Passwort-Anmeldung](https://firebase.google.com/docs/auth/web/password-auth)
- [Nutzer hinzufügen](https://support.google.com/firebase/answer/6400802)
- [Firestore-Sicherheitsregeln](https://firebase.google.com/docs/firestore/security/get-started)
- [Standardsites bei Hosting](https://firebase.google.com/docs/hosting/default-site)
- [Tarife](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
