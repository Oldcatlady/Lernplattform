// example-original-project ist eine reservierte Beispielkennung, kein reales Zielprojekt.
/* DOKU: Lädt die öffentliche Browserkonfiguration aus /private-settings.json per Top-Level-await. Firebase-Webkonfiguration und ownerUid sind für den Browser lesbar; hier gehören keine Service-Account-Schlüssel hinein. */
const response = await fetch('/private-settings.json', {cache:'no-cache'});
if (!response.ok) throw new Error('private-settings.json fehlt.');
export const privateSettings = await response.json();
export const firebaseConfig = privateSettings.firebaseConfig;
/* DOKU: Erkennt fehlende UID, Platzhalter und gesperrte Projekt-ID. Dies ist eine lokale Plausibilitätsprüfung, keine Überprüfung der tatsächlich veröffentlichten Firestore-Regeln. */
export function requirePrivateSetup() {
 if (!privateSettings.ownerUid || privateSettings.ownerUid === 'OWNER_UID_HERE' ||
     !firebaseConfig?.projectId || firebaseConfig.projectId === 'NEW_PROJECT_ID' ||
     firebaseConfig.projectId === 'example-original-project') {
   throw new Error('Bitte zuerst die neue private Firebase-Konfiguration eintragen.');
 }
}
