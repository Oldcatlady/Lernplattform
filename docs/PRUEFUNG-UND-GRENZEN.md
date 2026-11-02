# Prüfstand und bekannte Grenzen

## Veröffentlichungsvorlage

Diese Fassung baut auf der bereits kommentierten Projektkopie auf. Private Datenbestände, persönliche Einstellungen, generierte UID-Regeln, lokaler Firebase-Cache und node_modules sind nicht enthalten. Die fachliche Quiz- und Synchronisationslogik wurde für diese Vorbereitung nicht überarbeitet.

In vier Dateien wurde die konkrete historische Projekt-ID durch die synthetische reservierte Kennung example-original-project ersetzt. Die vorhandene Ablehnungsbedingung bleibt für diese Beispielkennung bestehen. Die tatsächliche persönliche ID ist dadurch nicht mehr Teil der öffentlichen Vorlage.

Die Hosting-Ausschlüsse wurden um Backups, private Arbeitsdaten, Dokumentation, Beispiele und typische lokale Schlüsseldateinamen ergänzt. private-settings.json bleibt auf Hosting lesbar, weil der Browsercode sie benötigt; sie wird lediglich aus Git ausgeschlossen. Ein unbekannt benannter Schlüssel im Hostingstamm wäre damit nicht automatisch sicher: Admin-Zugangsdaten bleiben außerhalb des gesamten Projektordners.

## Enthaltene Tests

Unter tools/tests stehen die vorhandenen Tests für Filter, Synchronisationskern, simulierte Seiten, Einrichtung und Themenpakete. Die Seite wird dabei in einer vereinfachten DOM-/Firebase-Umgebung nachgebildet. Echte Browser-, IndexedDB- und veröffentlichte Firestore-Regeln werden dadurch nicht vollständig geprüft.

Der frühere Test additive-import-tests.mjs wurde nicht in die Vorlage aufgenommen: Er hing von einer entfernten privaten Importdatei ab und enthielt Erwartungen an wiederholbare Importe, die nicht zum aktuellen Importwerkzeug passen. Die vorhandene Test-Sammeldatei hatte diesen Test ohnehin nicht aufgerufen.

Die frühere vollständige Testsuite wurde bei dieser Vorbereitung nicht ausgeführt. Die konkreten Kontrollen stehen im separaten Übergabebericht außerhalb des Repositorys.

## Bestehende Funktionsgrenzen

- mixed.html ist vorhanden, das Dashboard bietet aber nur MC, FC, BE und RF an.
- Kein sichtbarer manueller Synchronisationsbutton. loadLearningState wertet refresh derzeit nicht aus; der Cache kann einen zusätzlichen Cloud-Abruf innerhalb der Minutenfrist verhindern.
- chooseIds nutzt type nicht direkt. Die Bedarfslisten werden zuvor nach Quiztyp aufgebaut.
- statsShardKey in quiz-data-core.js ist ein älterer 128-Shard-Helfer; die aktuelle Synchronisation nutzt 16 Shards aus private-sync-core.js.
- Browserdaten bleiben nach dem Abmelden lokal erhalten. Löschen von Browserdaten kann noch nicht synchronisierte Antworten verlieren.
- Die Oberfläche ist für einen Besitzer pro Instanz gedacht. Sie ist keine Mehrbenutzer-Schulplattform.
- Die Vorlage legt nicht fest, welche gesetzlichen Informationspflichten eine konkrete Instanz oder ihre Außendarstellung hat. Jeder Betreiber muss den tatsächlichen Nutzungszweck selbst beurteilen.
