// annotations.js expects the Dexie global that vendor/dexie.min.js used to provide.
import Dexie from "dexie";

declare global {
  interface Window {
    Dexie: typeof Dexie;
  }
}

window.Dexie = Dexie;
