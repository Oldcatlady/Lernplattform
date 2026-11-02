/* DOKU: Gemeinsame Anmeldungsschranke der Browserseiten. Firebase Authentication liefert die Identität; ownerUid begrenzt die Oberfläche auf das freigegebene Konto. Serverseitige Berechtigungen stehen separat in firestore.rules. */
import {onAuthStateChanged as observe, signOut as firebaseSignOut} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {privateSettings,requirePrivateSetup} from './firebase-config.js';
/* DOKU: Wrapper des Firebase-Beobachters: fremde UID abmelden und zum Login führen, andernfalls den Seiten-Callback ausführen. Gibt die Abmeldefunktion des Beobachters zurück. */
export function onAuthStateChanged(auth, callback) {
 requirePrivateSetup();
 return observe(auth, async user => {
  if (user && user.uid !== privateSettings.ownerUid) {
   await firebaseSignOut(auth);
   if (!location.pathname.endsWith('/login.html')) location.replace('login.html');
   else document.getElementById('privateLoginError')?.replaceChildren(document.createTextNode('Dieses Konto hat keinen Zugang zu deiner privaten Lernplattform.'));
   return;
  }
  return callback(user);
 });
}
/* DOKU: Prüft Konfiguration und UID vor lokalen Datenoperationen. Wirft bei Abweichung einen Fehler; dies schützt allein keine serverseitigen Daten. */
export function requireOwner(uid) {
 requirePrivateSetup();
 if (uid !== privateSettings.ownerUid) throw new Error('Nur dein freigegebenes Konto darf zugreifen.');
}

/* DOKU: Versucht vor der Firebase-Abmeldung einen erzwungenen Cloud-Abgleich. Bei Fehler bleibt die lokale Antwortwarteschlange erhalten; die Abmeldung findet dennoch statt. */
export async function signOut(auth) {
 const uid=auth.currentUser?.uid;
 if(uid===privateSettings.ownerUid){
  try{const [{flush},{getFirestore}]=await Promise.all([
   import('./private-sync.js'),import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')]);
   await flush(getFirestore(auth.app),uid,true);
  }catch(error){console.error('Cloud-Abgleich vor Logout fehlgeschlagen; Antworten bleiben gesichert.',error);}
 }
 return firebaseSignOut(auth);
}
