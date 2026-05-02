import { initializeApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: __DEV__ ? "demo-no-project" : (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID"),
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Functions
export const functions = getFunctions(app);

// Connect to local emulator in development mode
if (__DEV__) {
  // Use '10.0.2.2' for Android Emulator, or your local IP for physical devices
  // Since you are running Expo, 'localhost' works if you are on an iOS simulator, 
  // but your local IP is safer for Expo Go. 
  // For now, we'll try 'localhost' and you can update if using a physical device.
  connectFunctionsEmulator(functions, "localhost", 5001);
  console.log("Connected to Firebase Functions Emulator (localhost:5001)");
}
