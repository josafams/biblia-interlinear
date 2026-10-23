// Screen size the layout depends on: on phones (≤ 720 px) Livros and Aparência live in the bottom bar.
const PHONE = "(max-width: 720px)";

const media = typeof matchMedia === "function" ? matchMedia(PHONE) : null;
export const layout = $state({ phone: !!media?.matches });
media?.addEventListener("change", e => {
  layout.phone = e.matches;
});

// Computer (≥ 1100 px): the entry, Anotar and Aparência open in the panel beside the text
const sideMedia = typeof matchMedia === "function" ? matchMedia("(min-width: 1100px)") : null;
export const side = $state({ on: !!sideMedia?.matches });
sideMedia?.addEventListener("change", e => {
  side.on = e.matches;
});
