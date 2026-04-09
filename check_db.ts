import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  const adminRef = doc(db, 'user_accounts', 'Admin');
  const snap = await getDoc(adminRef);
  console.log("Admin exists:", snap.exists());
  if (snap.exists()) {
    console.log("Admin data:", snap.data());
  } else {
    console.log("Creating Admin...");
    try {
      await setDoc(adminRef, {
        username: 'Admin',
        password: 'Admin',
        program: 'American',
        role: 'admin'
      });
      console.log("Created.");
    } catch (e) {
      console.error("Error creating admin:", e);
    }
  }
  process.exit(0);
}
check();
