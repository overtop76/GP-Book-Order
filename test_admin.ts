import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, getDocs, setDoc, doc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  try {
    const cred = await signInAnonymously(auth);
    console.log("Logged in:", cred.user.uid);
    
    // Create admin user doc
    await setDoc(doc(db, 'users', cred.user.uid), {
      username: 'Admin',
      role: 'admin',
      program: 'All'
    });
    console.log("Created admin user doc");

    // Try to list user_accounts
    const snap = await getDocs(collection(db, 'user_accounts'));
    console.log("user_accounts:", snap.docs.map(d => d.data()));

    // Try to create a user
    await setDoc(doc(db, 'user_accounts', 'testuser'), {
      username: 'testuser',
      password: 'password',
      role: 'coordinator',
      program: 'American'
    });
    console.log("Created testuser");
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
test();
