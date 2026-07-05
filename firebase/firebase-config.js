// firebase/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwafZXVwizBZc_LWqa0GnoXgki0HA833w",
  authDomain: "msplanning-52896.firebaseapp.com",
  projectId: "msplanning-52896",
  storageBucket: "msplanning-52896.firebasestorage.app",
  messagingSenderId: "336460882194",
  appId: "1:336460882194:web:c5601e884d1fbb7aba13cb",
  measurementId: "G-XM67DMGTQ2",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
// No storage export — images are uploaded to ImgBB (free, no plan required).
