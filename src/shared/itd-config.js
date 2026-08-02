/* ============================================================
   InTandem Desk — Firebase configuration

   THE ONLY PLACE THIS LIVES. Both the admin and the staff build
   read from here, so the two apps can never drift onto different
   Firebase projects.

   Firebase console → Project settings → General → Your apps →
   SDK setup and configuration → Config.

   These values are NOT secret. They ship in client source by
   design; access is controlled by firestore.rules and by the
   Authorized domains list in Firebase Authentication.
   ============================================================ */

window.ITD_FIREBASE = {
  apiKey: "AIzaSyCKFDR9yG4_KqNq9fqlwQXZD5JcMGTXiwc",
  authDomain: "intandem-desk.firebaseapp.com",
  projectId: "intandem-desk",
  storageBucket: "intandem-desk.firebasestorage.app",
  messagingSenderId: "266339886618",
  appId: "1:266339886618:web:96c9a60184c2cfaa6253a3"
};

/* True once real values are pasted above. build.mjs checks this and
   refuses to produce a deployable build while it is false. */
window.ITD_CONFIGURED = !!window.ITD_FIREBASE.apiKey && !/^PASTE/.test(window.ITD_FIREBASE.apiKey);
