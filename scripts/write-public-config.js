/**
 * Writes a PUBLIC_MODE config.json for web / Capacitor builds.
 * Reads PUBLIC_FIREBASE_* or NEXT_PUBLIC_FIREBASE_* from the environment.
 */
const fs = require("fs");
const path = require("path");

const e = process.env;
const outPath = path.resolve(process.argv[2] || "config.json");

const firebase = {
  apiKey: e.PUBLIC_FIREBASE_API_KEY || e.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: e.PUBLIC_FIREBASE_AUTH_DOMAIN || e.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: e.PUBLIC_FIREBASE_PROJECT_ID || e.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: e.PUBLIC_FIREBASE_STORAGE_BUCKET || e.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId:
    e.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || e.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: e.PUBLIC_FIREBASE_APP_ID || e.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: e.PUBLIC_FIREBASE_MEASUREMENT_ID || e.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

if (e.PUBLIC_FIREBASE_DATABASE_ID) {
  firebase.databaseId = e.PUBLIC_FIREBASE_DATABASE_ID;
} else if (!firebase.databaseId) {
  firebase.databaseId = "pudo-booking-pub";
}

const missing = ["apiKey", "authDomain", "projectId"].filter((k) => !firebase[k]);
if (missing.length) {
  console.error("Missing Firebase config fields:", missing.join(", "));
  process.exit(1);
}

Object.keys(firebase).forEach((k) => {
  if (!firebase[k]) delete firebase[k];
});

const config = {
  PUBLIC_MODE: true,
  PUDO_API_KEY: "",
  API_BASE_URL: e.API_BASE_URL || "https://api-pudo.co.za/api/v1",
  ECOMMERCE_BOOKING_URL: e.ECOMMERCE_BOOKING_URL || "",
  GOOGLE_MAPS_API_KEY: e.GOOGLE_MAPS_API_KEY || "",
  INTERNAL_EMAILS: [],
  FIREBASE: firebase,
};

fs.writeFileSync(outPath, JSON.stringify(config, null, 2));
console.log("Wrote", outPath);
