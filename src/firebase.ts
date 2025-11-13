// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCr8AFvLDd2oliLnvTMX0MvKk2OHR6SXL4",
  authDomain: "fantasy-hockey-b7851.firebaseapp.com",
  projectId: "fantasy-hockey-b7851",
  storageBucket: "fantasy-hockey-b7851.firebasestorage.app",
  messagingSenderId: "534335943239",
  appId: "1:534335943239:web:560caf176598847a9cb762",
  measurementId: "G-ZYEWJCFBV4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Export the app if needed elsewhere
export default app;