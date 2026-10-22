// Screen size the layout depends on: on phones (≤ 720 px) Livros and Aparência live in the bottom bar.
const PHONE = "(max-width: 720px)";

const media = typeof matchMedia === "function" ? matchMedia(PHONE) : null;
export const layout = $state({ phone: !!media?.matches });
media?.addEventListener("change", e => {
  layout.phone = e.matches;
});
