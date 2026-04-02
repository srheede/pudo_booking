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
import { db, auth } from "./config";
import config from "../../config.json";

/**
 * In PUBLIC_MODE, all data lives under users/{uid}/<collection>.
 * In internal mode, data lives at the root <collection> level (original behaviour).
 */
const getCollectionRef = (uid, collectionName) => {
  if (config.PUBLIC_MODE && uid) {
    return collection(db, "users", uid, collectionName);
  }
  return collection(db, collectionName);
};

const getDocRef = (uid, collectionName, docId) => {
  if (config.PUBLIC_MODE && uid) {
    return doc(db, "users", uid, collectionName, docId);
  }
  return doc(db, collectionName, docId);
};

// ─── Authentication ──────────────────────────────────────────────────────────

export const authService = {
  async signUp(email, password) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  async signIn(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  async signOut() {
    await signOut(auth);
  },

  getCurrentUser() {
    return auth.currentUser;
  },

  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },
};

// ─── User Profile (PUBLIC_MODE only) ─────────────────────────────────────────

export const userProfileService = {
  async get(uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  },

  async savePudoApiKey(uid, pudoApiKey) {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { pudoApiKey, updatedAt: serverTimestamp() }, { merge: true });
  },
};

// ─── Customers ───────────────────────────────────────────────────────────────

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

// ─── Sender ──────────────────────────────────────────────────────────────────

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

// ─── Bookings ────────────────────────────────────────────────────────────────

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

  async getMonthlyCount(uid) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const q = query(
      getCollectionRef(uid, "bookings"),
      where("createdAt", ">=", Timestamp.fromDate(startOfMonth))
    );
    const snap = await getDocs(q);
    return snap.size;
  },
};
