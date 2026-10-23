// The optional Google account as the "Você" tab shows it (src/reader/account.ts does the signing in and the Drive).
export type AccountStatus = "unavailable" | "signed-out" | "connecting" | "connected" | "reconnect";

export const accountView = $state({
  status: "signed-out" as AccountStatus,
  me: null as { nome?: string; email: string; photo?: string } | null,
  /** devices of the account in Drive (null until checked) */
  devices: null as number | null,
  sync: null as { tipo: string; texto: string } | null,
  error: "",
  /** "Guardar no Google Drive?" after the first annotation (AccountSuggestion.svelte) */
  suggestion: false
});
