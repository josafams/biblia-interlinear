// The Dexie global that vendor/dexie.min.js used to provide: the "Como usar" video scripts open the database
// with it (scripts/videos/roteiros.mjs).
import Dexie from "dexie";

declare global {
  interface Window {
    Dexie: typeof Dexie;
  }
}

window.Dexie = Dexie;
