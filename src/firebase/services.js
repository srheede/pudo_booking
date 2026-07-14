/**
 * Firebase / Firestore service layer
 *
 * All reads and writes to Firestore go through this file.  Components and
 * contexts import named service objects (customerService, bookingService, …)
 * rather than calling the Firestore SDK directly.
 *
 * ── Data layout per build mode ────────────────────────────────────────────────
 *
 *  INTERNAL session (PUBLIC_MODE=false build, or privileged email in a public build)
 *    • Data lives in flat, shared root collections:
 *        /customers/{id}
 *        /bookings/{id}
 *        /sender/default
 *    • All authenticated users share the same data set (single-user dev tool).
 *    • The users/{uid} document is never read or written.
 *
 *  PUBLIC session (PUBLIC_MODE=true, non-privileged email)
 *    • Data lives under each user's sub-collections:
 *        /users/{uid}/customers/{id}
 *        /users/{uid}/bookings/{id}
 *        /users/{uid}/sender/default
 *    • Every user has their own isolated data set.
 *    • The users/{uid} ROOT document (not a sub-collection) holds:
 *        subscriptionStatus   — "active" | "cancelled" | …
 *        subscriptionEndDate  — Firestore Timestamp
 *        subscriptionTier     — "starter" | "professional" | "enterprise"
 *        pudoApiKey           — the user's PUDO API key (set via ApiKeySetupPage)
 *      This document is managed externally (e.g. by a Stripe webhook in the
 *      pudo_booking_homepage project) and is READ ONLY from this app.
 *      The only field this app ever writes is pudoApiKey (via savePudoApiKey).
 *
 * getCollectionRef / getDocRef transparently return the correct path for the
 * active session mode, so service methods work identically in both modes.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
  Timestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  db,
  auth,
  isInternalSession,
  hasInternalFirebase,
  isInternalEmail,
  activateInternalMode,
  activatePublicMode,
  getInternalAuth,
  getPrimaryAuth,
} from "./config";
import config from "../../config.json";

// ── Path helpers ──────────────────────────────────────────────────────────────
// Public session → /users/{uid}/{collection}  (per-user sub-collections)
// Internal session → /{collection}            (shared root collections)

const usePublicPaths = () => config.PUBLIC_MODE && !isInternalSession;

const getCollectionRef = (uid, collectionName) => {
  if (usePublicPaths() && uid) {
    return collection(db, "users", uid, collectionName);
  }
  return collection(db, collectionName);
};

const getDocRef = (uid, collectionName, docId) => {
  if (usePublicPaths() && uid) {
    return doc(db, "users", uid, collectionName, docId);
  }
  return doc(db, collectionName, docId);
};

// ── Authentication ─────────────────────────────────────────────────────────────
// Used in both modes.  Firebase Auth provides the login/logout flow regardless
// of PUBLIC_MODE; in internal mode it simply gates access to the developer.
// In public builds with INTERNAL_FIREBASE, privileged emails authenticate
// against the internal project instead.

export const authService = {
  async signUp(email, password) {
    if (config.PUBLIC_MODE && isInternalEmail(email) && hasInternalFirebase()) {
      const err = new Error(
        "This email is reserved for the private account. Please sign in instead."
      );
      err.code = "auth/email-already-in-use";
      throw err;
    }
    activatePublicMode();
    const userCredential = await createUserWithEmailAndPassword(
      getPrimaryAuth(),
      email,
      password
    );
    return userCredential.user;
  },

  async signIn(email, password) {
    if (config.PUBLIC_MODE && isInternalEmail(email) && hasInternalFirebase()) {
      activateInternalMode();
      const userCredential = await signInWithEmailAndPassword(
        getInternalAuth(),
        email,
        password
      );
      return userCredential.user;
    }
    activatePublicMode();
    const userCredential = await signInWithEmailAndPassword(
      getPrimaryAuth(),
      email,
      password
    );
    return userCredential.user;
  },

  async signOut() {
    const primary = getPrimaryAuth();
    const internal = getInternalAuth();
    const tasks = [];
    if (primary?.currentUser) tasks.push(signOut(primary));
    if (internal?.currentUser) tasks.push(signOut(internal));
    await Promise.all(tasks);
    activatePublicMode();
  },

  getCurrentUser() {
    return auth.currentUser;
  },

  onAuthStateChanged(callback) {
    if (!hasInternalFirebase()) {
      return onAuthStateChanged(getPrimaryAuth(), callback);
    }

    const primary = getPrimaryAuth();
    const internal = getInternalAuth();
    let lastKey = undefined;

    const emit = (user, useInternal) => {
      const key = user ? `${useInternal ? "i" : "p"}:${user.uid}` : "null";
      if (key === lastKey) return;
      lastKey = key;
      if (user) {
        if (useInternal) activateInternalMode();
        else activatePublicMode();
      } else {
        activatePublicMode();
      }
      callback(user);
    };

    const unsubInternal = onAuthStateChanged(internal, (user) => {
      if (user) emit(user, true);
      else if (!primary.currentUser) emit(null, false);
    });

    const unsubPrimary = onAuthStateChanged(primary, (user) => {
      // Prefer an active internal session if both somehow exist.
      if (internal.currentUser) return;
      if (user) emit(user, false);
      else emit(null, false);
    });

    return () => {
      unsubInternal();
      unsubPrimary();
    };
  },
};

// ── User Profile (PUBLIC_MODE=true only) ──────────────────────────────────────
// Reads/writes the users/{uid} ROOT document in the PUBLIC Firestore database.
// This document is the source of truth for subscription state and the PUDO key.
// It is written externally (Stripe webhook) and read here on every login.

export const userProfileService = {
  // Returns the document data object, or null if the document does not exist.
  async get(uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  },

  // Called by ApiKeySetupPage after the user saves their PUDO API key.
  // Uses merge:true so it never overwrites subscription fields set by the webhook.
  async savePudoApiKey(uid, pudoApiKey) {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { pudoApiKey, updatedAt: serverTimestamp() }, { merge: true });
  },
};

// ── Customers ─────────────────────────────────────────────────────────────────
// PUBLIC_MODE=true  → /users/{uid}/customers/
// PUBLIC_MODE=false → /customers/

export const customerService = {
  async getAll(uid) {
    const q = query(getCollectionRef(uid, "customers"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async add(uid, customerData) {
    const ref = await addDoc(getCollectionRef(uid, "customers"), {
      ...customerData,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(uid, id, customerData) {
    const ref = getDocRef(uid, "customers", id);
    await updateDoc(ref, { ...customerData, updatedAt: serverTimestamp() });
  },

  async delete(uid, id) {
    await deleteDoc(getDocRef(uid, "customers", id));
  },

  async getById(uid, id) {
    const ref = getDocRef(uid, "customers", id);
    const snap = await getDoc(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    return null;
  },
};

// ── Sender details ────────────────────────────────────────────────────────────
// PUBLIC_MODE=true  → /users/{uid}/sender/default
// PUBLIC_MODE=false → /sender/default

export const senderService = {
  async get(uid) {
    const ref = getDocRef(uid, "sender", "default");
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    return null;
  },

  async update(uid, senderData) {
    const ref = getDocRef(uid, "sender", "default");
    await setDoc(ref, { ...senderData, updatedAt: serverTimestamp() }, { merge: true });
  },

  async create(uid, senderData) {
    const ref = getDocRef(uid, "sender", "default");
    await setDoc(ref, { ...senderData, createdAt: serverTimestamp() });
  },
};

// ── Bookings ──────────────────────────────────────────────────────────────────
// PUBLIC_MODE=true  → /users/{uid}/bookings/
// PUBLIC_MODE=false → /bookings/

export const bookingService = {
  async getAll(uid) {
    const q = query(getCollectionRef(uid, "bookings"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async add(uid, bookingData) {
    const ref = await addDoc(getCollectionRef(uid, "bookings"), {
      ...bookingData,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(uid, id, bookingData) {
    const ref = getDocRef(uid, "bookings", id);
    await updateDoc(ref, { ...bookingData, updatedAt: serverTimestamp() });
  },

  async delete(uid, id) {
    await deleteDoc(getDocRef(uid, "bookings", id));
  },

  async getByCustomer(uid, customerId) {
    const q = query(
      getCollectionRef(uid, "bookings"),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async getMonthlyCount(uid, periodStart) {
    // Use the subscription renewal date as the start of the billing period so
    // the count resets when the subscription renews, not on the calendar month.
    // Falls back to start of calendar month if no renewal date is available.
    const start =
      periodStart instanceof Date
        ? periodStart
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const q = query(
      getCollectionRef(uid, "bookings"),
      where("createdAt", ">=", Timestamp.fromDate(start))
    );
    const snap = await getDocs(q);
    return snap.size;
  },
};
