import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import config from "../../config.json";

const firebaseConfig = config.FIREBASE;

// Validate the Firebase config at startup so a misconfigured build fails with
// a clear message rather than a silent blank page.
const missingKeys = ["apiKey", "authDomain", "projectId"].filter(
  (k) => !firebaseConfig?.[k]
);
if (missingKeys.length > 0) {
  const msg =
    `Firebase config is missing or empty: ${missingKeys.join(", ")}.\n` +
    "In production this means the GitHub Secrets (PUB_FIREBASE_*) are not set correctly.";
  // Surface the error visually in the renderer
  document.addEventListener("DOMContentLoaded", () => {
    document.body.innerHTML = `<pre style="padding:32px;font-family:monospace;color:red;white-space:pre-wrap">${msg}</pre>`;
  });
  throw new Error(msg);
}

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
