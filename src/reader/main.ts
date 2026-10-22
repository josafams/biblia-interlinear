// Reader entry point. The legacy scripts are imported in the order the page used to load them;
// they still talk through window.* globals until phase 3 extracts typed modules into src/lib.
import "./dexie-global";
import "../../web/reader.js";
import "../../web/study.js";
import "../../web/search.js";
import "../../web/annotations.js";
import "../../web/account.js";
import "../../web/sync.js";
import "../../web/progress.js";
