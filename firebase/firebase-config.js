// See ARCHITECTURE.md for the full setup walkthrough.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";

// Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDwafZXVwizBZc_LWqa0GnoXgki0HA833w",
  authDomain: "msplanning-52896.firebaseapp.com",
  projectId: "msplanning-52896",
  storageBucket: "msplanning-52896.firebasestorage.app",
  messagingSenderId: "336460882194",
  appId: "1:336460882194:web:c5601e884d1fbb7aba13cb",
  measurementId: "G-XM67DMGTQ2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

// const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);