// See ARCHITECTURE.md for the full setup walkthrough.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Your web app's Firebase configuration
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

export const auth = getAuth(app);

// Local caching: reads/writes persist to IndexedDB, so repeat visits load
// from cache instantly and the app keeps working briefly offline. This is
// project-wide — every collection/onSnapshot call benefits automatically.
// Multi-tab manager so having e.g. the admin dashboard and the storefront
// open in two tabs doesn't conflict.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
