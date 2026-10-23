// Reader entry point: the reader (src/reader/reader.ts), then the scripts that talk to it through window.*
// bridges, in the order the page has always loaded them.
import "../styles/reader.css";
import "./dexie-global";
import "./reader";
import "../../web/study.js";
import "../../web/search.js";
import "./annotations";
import "../../web/account.js";
import "../../web/sync.js";
import "../../web/progress.js";
