<!-- Shortcuts under the chapter title: "Sobre João" (opens the book introduction), Léxico and Perguntas (scroll there). -->
<script lang="ts">
  import { t } from "../i18n";
  import { reader } from "../state/reader.svelte";

  let { onabout, ongo }: { onabout: () => void; ongo: (selector: string) => void } = $props();
  const h = $derived(reader.heading);
  const go = (e: MouseEvent, selector: string) => {
    e.preventDefault();
    ongo(selector);
  };
</script>

<div class="hchips" id="hchips" data-testid="header-chips">
  <button
    class="hchip"
    type="button"
    id="chip-about"
    aria-expanded={reader.aboutOpen}
    aria-controls="sobre"
    hidden={!!h && !h.hasAbout}
    onclick={onabout}>{h ? t("header.about_book", { book: h.book }) : t("header.about")}</button
  >
  <a class="hchip" href="#lexico" id="chip-lex" data-go-local onclick={e => go(e, "#lexico")}>{t("header.lexicon")}</a>
  <a class="hchip" href="#perguntas" id="chip-q" data-go-local hidden={!reader.questions.length} onclick={e => go(e, "#perguntas")}
    >{t("header.questions")} <span class="n">{reader.questions.length}</span></a
  >
</div>
