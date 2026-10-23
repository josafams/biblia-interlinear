<!--
  First-use hints: each one shows once, when it makes sense, and goes away by itself. They never cover a
  notice. No markup: they are shown by Toast.svelte.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { store } from "../lib/store";
  import { annotate } from "../state/annotate.svelte";
  import { entry } from "../state/entry.svelte";
  import { noticeShown, showToast } from "../state/toast.svelte";
  import { ui } from "../state/ui.svelte";

  type Hint = "palavra" | "versiculo" | "verbete";
  const keyboard = matchMedia("(hover: hover) and (pointer: fine)").matches; // i18n-ignore
  const TEXT = {
    palavra: () => t("hints.word"),
    versiculo: () => t("hints.verse"),
    verbete: () => t(keyboard ? "hints.entry_keys" : "hints.entry")
  };
  const seen = (id: Hint) => store.get("dica-" + id, "") === "vista";
  const markSeen = (id: Hint) => store.set("dica-" + id, "vista");
  function hint(id: Hint) {
    if (seen(id) || noticeShown()) return false;
    markSeen(id);
    showToast(TEXT[id](), { hint: true, ms: 7000 });
    return true;
  }
  const hasWords = () => !!document.querySelector("#verses .word"); // i18n-ignore
  function onchapter() {
    setTimeout(() => {
      if (ui.sheet || entry.open || annotate.open) return;
      if (hasWords() && hint("palavra")) return;
      if (seen("palavra") || !hasWords()) hint("versiculo");
    }, 1200);
  }
  function onword(e: Event) {
    if (!(e as CustomEvent).detail.word) return; // opened from the lexicon, not a word of the text
    markSeen("palavra");
    hint("verbete");
  }
  $effect(() => {
    if (annotate.open) markSeen("versiculo");
  });
  $effect(() => {
    document.addEventListener("chapter-rendered", onchapter);
    document.addEventListener("word-opened", onword);
    return () => {
      document.removeEventListener("chapter-rendered", onchapter);
      document.removeEventListener("word-opened", onword);
    };
  });
</script>
