// Reader entry point: the styles, the reader (src/reader/reader.ts), then the parts that start when imported, in
// this order: the concordance and the search use the reader; the sync and the progress use the annotations and
// the account (window.Annotations, window.Account); the reminders use the progress.
import "../styles/reader.css";
import "./dexie-global";
import "./reader";
import "./concordance";
import "./search";
import "./annotations";
import "./account";
import "./sync";
import "./progress";
import "./reminders";
