import { initializeApp } from "firebase/app";
import { getFunctions } from "firebase/functions";

// Firebase configuration for genkimi-app
// These are public client-side keys (safe to include in the app bundle)
const firebaseConfig = {
  apiKey: "AIzaSyDuILyjJJOeFKflowEW6qDldBIc3A0p2JY",
  authDomain: "genkimi-app.firebaseapp.com",
  projectId: "genkimi-app",
  storageBucket: "genkimi-app.firebasestorage.app",
  messagingSenderId: "1065552148560",
  appId: "1:1065552148560:web:c7f170bed96f9f78853955",
  measurementId: "G-TETBQP7X9W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Functions (us-central1 region)
export const functions = getFunctions(app, "us-central1");
