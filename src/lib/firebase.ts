import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDSITfW6x2yaL4ZmAepbT9aNJa8U7rK8hc",
  authDomain: "voice-to-notes-1deeb.firebaseapp.com",
  projectId: "voice-to-notes-1deeb",
  storageBucket: "voice-to-notes-1deeb.firebasestorage.app",
  messagingSenderId: "334705623680",
  appId: "1:334705623680:web:6116204634211804089c65",
  measurementId: "G-E5CE27C1LL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);