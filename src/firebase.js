import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD-wUfqXHMuZeUl1AGpNlqrJgFSVpYSu-k",
  authDomain: "smart-farming-assistant-867f8.firebaseapp.com",
  projectId: "smart-farming-assistant-867f8",
  storageBucket: "smart-farming-assistant-867f8.firebasestorage.app",
  messagingSenderId: "181018188410",
  appId: "1:181018188410:web:6f3bce9832fd81932c79c3"
};

// Initialize Firebase directly
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { auth, googleProvider, signInWithPopup, signOut };
export default auth;
