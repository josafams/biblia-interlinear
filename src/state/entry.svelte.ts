// The lexicon entry open in #detail (the sheet on phones, the side panel on computers).
import type { EntryView } from "../lib/lexicon/entry";

export const entry = $state({
  /** the panel is showing */
  open: false,
  view: null as EntryView | null,
  /** the ‹ › buttons: is there a word before / after in reading order */
  canPrev: false,
  canNext: false,
  /** "← voltar ao verbete anterior" (an entry opened from a Strong number of another) */
  canGoBack: false
});
