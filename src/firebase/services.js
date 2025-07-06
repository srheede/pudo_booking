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
} from "firebase/firestore";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { db, auth } from "./config";

// Authentication Services
export const authService = {
  // Sign up with email and password
  async signUp(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  },

  // Sign in with email and password
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  },

  // Sign out
  async signOut() {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  },

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  },

  // Listen to auth state changes
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },
};

// Customer Services
export const customerService = {
  // Get all customers
  async getAll() {
    const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  },

  // Add new customer
  async add(customerData) {
    const docRef = await addDoc(collection(db, "customers"), {
      ...customerData,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  // Update customer
  async update(id, customerData) {
    const customerRef = doc(db, "customers", id);
    await updateDoc(customerRef, {
      ...customerData,
      updatedAt: serverTimestamp(),
    });
  },

  // Delete customer
  async delete(id) {
    const customerRef = doc(db, "customers", id);
    await deleteDoc(customerRef);
  },

  // Get customer by ID
  async getById(id) {
    const customerRef = doc(db, "customers", id);
    const customerSnap = await getDoc(customerRef);
    if (customerSnap.exists()) {
      return { id: customerSnap.id, ...customerSnap.data() };
    }
    return null;
  },
};

// Sender Services
export const senderService = {
  // Get sender details
  async get() {
    const senderRef = doc(db, "sender", "default");
    const senderSnap = await getDoc(senderRef);
    if (senderSnap.exists()) {
      return senderSnap.data();
    }
    return null;
  },

  // Update sender details (creates if doesn't exist)
  async update(senderData) {
    const senderRef = doc(db, "sender", "default");
    await setDoc(
      senderRef,
      {
        ...senderData,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  // Create initial sender record
  async create(senderData) {
    const senderRef = doc(db, "sender", "default");
    await setDoc(senderRef, {
      ...senderData,
      createdAt: serverTimestamp(),
    });
  },
};

// Booking Services
export const bookingService = {
  // Get all bookings
  async getAll() {
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  },

  // Add new booking
  async add(bookingData) {
    const docRef = await addDoc(collection(db, "bookings"), {
      ...bookingData,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  // Update booking
  async update(id, bookingData) {
    const bookingRef = doc(db, "bookings", id);
    await updateDoc(bookingRef, {
      ...bookingData,
      updatedAt: serverTimestamp(),
    });
  },

  // Delete booking
  async delete(id) {
    const bookingRef = doc(db, "bookings", id);
    await deleteDoc(bookingRef);
  },

  // Get bookings by customer
  async getByCustomer(customerId) {
    const q = query(
      collection(db, "bookings"),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  },
};
