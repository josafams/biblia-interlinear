// The "How to use" storyboards in English (#8): the group names, and for each video (scripts/videos/roteiros.mjs, by
// id) its title, description and one caption per step, in the same order. The actions are the same; what they type
// or look for on the screen in English comes from TYPED below.

export const groups = {
  ler: "Read and navigate",
  aparencia: "Appearance",
  modos: "Reading modes",
  anotacoes: "Notes",
  conta: "Account",
  estudo: "Study",
  instalar: "Install and download"
};

// what the storyboards type, select or look for on the screen, and their sample notes, in English
export const TYPED = {
  "jo 3:16": "jn 3:16",
  "sl 23": "ps 23",
  luz: "light",
  "Haja luz": "Let there be light",
  "Sem forma e vazia: tôhû wâbôhû rima no hebraico.": "Formless and void: tohu wabohu rhymes in Hebrew.",
  "Tohu e bohu": "Tohu and bohu",
  promessas: "promises",
  pastor: "shepherd",
  "promessas de Deus": "God's promises",
  Sincronizado: "Synced",
  "Rute escolhe ficar com Noemi e com o povo dela.": "Ruth chooses to stay with Naomi and with her people.",
  "graca paz": "grace peace",
  "Sl 23": "Ps 23",
  Filho: "Son",
  amou: "loved",
  "Sem forma e vazia: rima no hebraico.": "Formless and void: a rhyme in Hebrew.",
  "E disse Deus: Haja luz; e houve luz.": "And God said, “Let there be light,” and there was light.",
  "Salmo de Davi: O SENHOR é meu pastor, nada me faltará.": "The LORD is my shepherd; I shall not want.",
  "Todas as coisas contribuem para o bem.": "God works all things together for good.",
  "No princípio": "In the beginning",
  "Bereshit: “no princípio”. A Bíblia começa com Deus, não com explicações.":
    "Bereshit: “in the beginning”. The Bible begins with God, not with explanations."
};

export const videos = {
  "01": {
    titulo: "Open a book and a chapter",
    desc: "From Books, with one tap on the chapter.",
    steps: [
      "Tap Books (in the bottom bar on the phone, in the top bar on the computer).",
      "Pick the book: Exodus. Next to the name, how many chapters it has.",
      "Tap the chapter: it opens right away.",
      "Scroll to read. The top shows where you are, and the thin line, how much you have read."
    ]
  },
  "02": {
    titulo: "Go to any verse",
    desc: "Jn 3:16, ps 23, 1:14 or ch 12.",
    steps: [
      "Tap Books.",
      "In the Books search, type the book, chapter and verse: jn 3:16.",
      "Tap Go: the verse opens highlighted.",
      "It also works with “ps 23”, “1:14” or just the verse number."
    ]
  },
  "03": {
    titulo: "Previous and next chapter",
    desc: "From the bar, the end of the chapter and the title.",
    steps: [
      "The arrows in the bar go to the previous or the next chapter.",
      "At the end of the chapter, the card goes to the next one.",
      "Tapping the title, at the top, opens the chapters of the book.",
      "Tap a chapter to go to it."
    ]
  },
  "04": {
    titulo: "How to read a card",
    desc: "Word, transliteration, Strong's and gloss.",
    steps: [
      "Each card is a word of the original.",
      "Hebrew reads from right to left.",
      "Below: transliteration, Strong's number and English gloss.",
      "Under the cards comes the verse in the Berean Standard Bible."
    ]
  },
  "05": {
    titulo: "Open an entry",
    desc: "Origin, meaning and from entry to entry.",
    steps: [
      "Tap a word to open its entry.",
      "See the meaning, how the BSB translates it and the origin.",
      "Tap a Strong's number to go to the linked entry.",
      "Use ← to go back to the previous entry.",
      "The ‹ › arrows go to the next word without closing. ✕ closes."
    ]
  },
  "06": {
    titulo: "Chapter lexicon",
    desc: "Every word of the chapter, with search.",
    steps: [
      "At the end of the chapter is the lexicon of all its words.",
      "Search in English, by transliteration or by number: light.",
      "Tap a row to open the entry."
    ]
  },
  "07": {
    titulo: "About the book",
    desc: "Summary, people, timeline and places.",
    steps: [
      "Tap “About” and the name of the book, above the text.",
      "Summary, authorship and date, main people…",
      "…timeline, context and places."
    ]
  },
  "08": {
    titulo: "Listen to the chapter",
    desc: "Word-by-word highlight and a slower voice.",
    steps: [
      "Tap Listen: reading starts at the verse on the screen.",
      "Each word is highlighted as it is read. Tap again to stop.",
      "To hear a single verse, tap ⋯ next to it and Listen.",
      "In Appearance › Audio it can speak more slowly."
    ]
  },
  10: {
    titulo: "Use the keyboard",
    desc: "Tab, arrows, Enter and Esc.",
    steps: [
      "Tab moves from verse to verse.",
      "The ← → arrows move between words in reading order.",
      "Enter opens the entry.",
      "Esc closes.",
      "[ and ] change the chapter.",
      "/ opens the search."
    ]
  },
  11: {
    titulo: "Light, dark and themes",
    desc: "Six color themes, or follow the device.",
    steps: [
      "In Aa there are six color themes.",
      "Dark for reading at night.",
      "Pick a theme: Paper.",
      "“Automatic” follows the device's theme."
    ]
  },
  12: {
    titulo: "Text size",
    desc: "Bigger and smaller.",
    steps: ["Tap Aa.", "Use A+ to make the text bigger.", "And A− to make it smaller. The choice is saved."]
  },
  13: {
    titulo: "Easy reading and cantillation",
    desc: "Font, spacing and Hebrew marks.",
    steps: [
      "In Aa › Text are the reading settings.",
      "An easy-reading font for the English text.",
      "Wide spacing between lines and letters.",
      "Turn off the cantillation marks to see only consonants and vowels."
    ]
  },
  14: {
    titulo: "Card layers",
    desc: "Turn on and off what shows.",
    steps: [
      "In Aa › What to show, choose what appears.",
      "Turn on the pronunciation (stressed syllable in capitals).",
      "Turn on the Strong's number to study with the dictionary.",
      "Close to see the result."
    ]
  },
  15: {
    titulo: "Change the mode",
    desc: "Bible, Original, Interlinear, Study.",
    steps: [
      "Tap Aa: the first group is the reading mode.",
      "Bible: only the Berean Standard Bible, in paragraphs, like an ordinary Bible.",
      "Original: only the Hebrew or the Greek, running. A word opens its entry.",
      "Interlinear: the word-by-word cards with the BSB.",
      "Study: everything in Interlinear plus Strong's, pronunciation and grammar."
    ]
  },
  16: {
    titulo: "Custom mode",
    desc: "Choose each item on the screen.",
    steps: [
      "In Aa, pick a mode to start from: Study.",
      "In “What to show”, turn each item on or off.",
      "When any item changes, the mode becomes Custom.",
      "The choice is saved for next time."
    ]
  },
  17: {
    titulo: "Interlinear of one verse",
    desc: "Reading in Bible mode, with one tap.",
    steps: [
      "In Bible mode the text runs in paragraphs.",
      "Tap the number of a verse.",
      "The cards of the original appear for that verse only.",
      "Tap the number again to close."
    ]
  },
  18: {
    titulo: "Highlight with colors",
    desc: "A verse, a passage or a word of the original.",
    steps: [
      "Tap ⋯ next to the verse (or long-press it).",
      "Pick one of the five colors.",
      "Select a passage of the BSB to highlight just that.",
      "The bar appears with the passage: pick the color.",
      "A long press on a word of the original highlights just the word."
    ]
  },
  19: {
    titulo: "Write a note",
    desc: "Linked to the verse; saved on its own.",
    steps: [
      "Tap ⋯ on the verse and Note.",
      "Write in the note: it saves on its own as you type.",
      "Close: the start of the note shows under the verse.",
      "Tap it to open it full screen and give it a title."
    ]
  },
  20: {
    titulo: "Favorites and tags",
    desc: "Organize by subject.",
    steps: [
      "Tap ⋯ on the verse and Favorite: the star appears.",
      "In More, under tags, create a new one: promises.",
      "The tag is ready for other verses and notes.",
      "Close: the tags show under the verse."
    ]
  },
  21: {
    titulo: "My notes",
    desc: "Search and filter everything.",
    steps: [
      "In Books, tap the Notes tab.",
      "Everything you highlighted and wrote, verse by verse, in the order of the Bible.",
      "Search for a word: shepherd.",
      "Or filter by type and by tag.",
      "Tap an item to go to the verse or open the note."
    ]
  },
  22: {
    titulo: "Export as PDF",
    desc: "The study notebook, ready to save.",
    steps: [
      "In Notes, in the ⋯ menu, tap Export PDF.",
      "Choose what goes in: notes, highlights, the text, the interlinear.",
      "Tap Make PDF.",
      "The notebook comes grouped by verse, with the colors, notes and tags. Save it as PDF or print it."
    ]
  },
  23: {
    titulo: "Download and import my data",
    desc: "A backup in a file.",
    steps: [
      "In Notes, in the ⋯ menu, tap Download my data.",
      "A file with everything you wrote is saved on the device.",
      "On another device, tap Import and choose that file.",
      "The notes come back. What already existed is not duplicated."
    ]
  },
  24: {
    titulo: "Sign in with Google",
    desc: "And send what you already wrote.",
    steps: [
      "In Books, on the You tab, tap Sign in with Google.",
      "Pick your account and allow it: the app only reaches its own private folder in your Google Drive.",
      "What you had already written on this device is sent to the account on its own.",
      "From then on, everything syncs on its own between your devices."
    ]
  },
  25: {
    titulo: "Two devices",
    desc: "A note written on the computer shows on the phone.",
    steps: [
      "With the same account on the phone and the computer, the notes are on both.",
      "A note written on the other device…",
      "…arrives here on its own within seconds, with the app open.",
      "Tap the note under the verse to read it."
    ]
  },
  26: {
    titulo: "Sign out and delete from the cloud",
    desc: "Your data, under your control.",
    steps: [
      "Your account is in Books, on the You tab.",
      "In Sign out, you choose to keep a copy of the notes here or to delete them from this device.",
      "To delete everything from your Google Drive, tap Delete my data from Google Drive.",
      "Confirm. The notes stay on this device and you are signed out."
    ]
  },
  27: {
    titulo: "Questions on the text",
    desc: "Think about the chapter and write down the answer.",
    steps: [
      "At the end of the chapter are the Questions on the text: 3 to 5, without answers, to think about alone or in a group.",
      "There are four kinds: observe, interpret, in the original and apply.",
      "The verse of a question takes you straight to the text.",
      "In the question about the original, the Hebrew or Greek word opens its entry.",
      "Write an answer opens the verse panel, with the question on top.",
      "Tap Done: the note goes to Notes. To hide the questions: Aa › What to show › Questions."
    ]
  },
  31: {
    titulo: "My progress",
    desc: "Chapters read, time and a reading plan.",
    steps: [
      "In Books, on the You tab, tap My progress (with the Google account connected).",
      "How much of the Bible you have read, your streak and your reading time — added up across all your devices.",
      "The chart shows the reading time per day; you can see the month or the year.",
      "Each book is colored by how much of it you have read. Tap a book…",
      "…to see its chapters. One tap marks or unmarks a chapter as read.",
      "Go back and choose a reading plan: each day's reading shows here."
    ]
  },
  32: {
    titulo: "Search the Bible",
    desc: "Words, references and Strong's numbers.",
    steps: [
      "Tap the magnifying glass, at the top.",
      "Type words: accents and capitals do not matter.",
      "The verses with all the words show up, already highlighted.",
      "Filter by testament or just in the book you are reading.",
      "A reference becomes a shortcut: Ps 23.",
      "Tap to go."
    ]
  },
  33: {
    titulo: "The word and the translation",
    desc: "See in English what each word translates.",
    steps: [
      "Open a word of the original: its translation is highlighted in the BSB.",
      "The other way too: tap a word of the BSB…",
      "…and the card of the original it translates lights up."
    ]
  },
  34: {
    titulo: "Every occurrence",
    desc: "Where else the Bible uses the same word.",
    steps: [
      "In the entry, tap See the occurrences.",
      "The list comes in the order of the Bible, with the word highlighted in each verse.",
      "Filter by translation: loved.",
      "Or just in the book you are reading.",
      "Tap a verse to go to it."
    ]
  },
  35: {
    titulo: "Organize the tags",
    desc: "Rename, merge and delete.",
    steps: [
      "In Notes, the tags show as filters.",
      "In the ⋯ menu, tap Manage tags.",
      "Change the name in the field. Giving it the name of another tag merges the two.",
      "Deleting takes two taps and removes the tag from the verses."
    ]
  },
  28: {
    titulo: "Install on the home screen",
    desc: "Android and iPhone, without a store.",
    steps: [
      "Android (Chrome): open the website, tap the ⋮ menu and “Install app” or “Add to Home screen”.",
      "iPhone (Safari): tap Share and “Add to Home Screen”.",
      "Done: the icon opens the Bible full screen, even without internet."
    ]
  },
  29: {
    titulo: "Install the APK",
    desc: "The app with the whole Bible inside.",
    steps: [
      "On the Android phone, open the repository's Releases › app-android page.",
      "Tap the .apk file to download it.",
      "Open the downloaded file and allow installing apps from this source when Android asks.",
      "Tap Install and then Open."
    ]
  },
  30: {
    titulo: "EPUB on the Kindle",
    desc: "With Send to Kindle.",
    steps: [
      "Download the EPUB in the Download section of this page (the OT, the NT or one book, if sending by email).",
      "Open Amazon's Send to Kindle website or app and send the file.",
      "The book shows in the Kindle library; tap a word of the original to see the note."
    ]
  }
};
