import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const app = initializeApp(config);
const auth = getAuth(app);

async function check() {
  try {
    const userCredential = await signInAnonymously(auth);
    console.log("Signed in anonymously:", userCredential.user.uid);
  } catch (e) {
    console.error("Error signing in anonymously:", e);
  }
  process.exit(0);
}
check();
