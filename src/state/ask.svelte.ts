// A simple question with buttons (AskDialog.svelte), instead of the browser dialogs: "Sair da conta",
// "Apagar meus dados do Google Drive", the progress questions.
export type AskButton = { id: string; texto: string; prim?: boolean; perigo?: boolean };

export const askView = $state({
  open: false,
  title: "",
  text: "",
  buttons: [] as AskButton[]
});

let answer: ((id: string) => void) | null = null;

/** Shows the question; resolves with the id of the button chosen ("" = cancel, Esc or a tap outside). */
export function ask(title: string, text: string, buttons: AskButton[]) {
  answer?.("");
  Object.assign(askView, { open: true, title, text, buttons });
  return new Promise<string>(ok => (answer = ok));
}

export function answerAsk(id: string) {
  askView.open = false;
  const done = answer;
  answer = null;
  done?.(id);
}
