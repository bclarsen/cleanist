import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAjDw0R--wWvrD9oP1fV02J-Rk7gyy7Aw8",
    authDomain: "cleaner-app-e63bc.firebaseapp.com",
    projectId: "cleaner-app-e63bc",
    storageBucket: "cleaner-app-e63bc.firebasestorage.app",
    messagingSenderId: "488147887616",
    appId: "1:488147887616:web:44e769d2b715978239dae5",
    measurementId: "G-B5WF881JM5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

