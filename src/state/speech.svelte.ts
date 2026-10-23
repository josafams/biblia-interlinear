// The reading aloud in progress, for the mini player and the Ouvir buttons.
export const speech = $state({
  on: false,
  /** "Lendo João 3:16 · grego" */
  label: "",
  /** Aparência › Áudio: which voices this device has */
  voiceNote: "",
  /** Android: the button that opens the system screen to install voices */
  canInstallVoices: false
});
