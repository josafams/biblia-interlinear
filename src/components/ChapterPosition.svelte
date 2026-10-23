<!--
  Long chapters (40 verses or more), in the top bar once the page has scrolled: "v. 60 de 176" and, when the
  chapter has sections (Psalm 119), the section name and ‹ › to the previous and the next section.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { reader } from "../state/reader.svelte";

  let scrollY = $state(0);
  const here = $derived(reader.here?.verse ?? 0);
  const heads = $derived(reader.sections);
  const cur = $derived(heads.filter(s => s.n <= here).pop());
  const shown = $derived(reader.verseCount >= 40 && scrollY >= 300);
  const arrows = $derived(heads.length > 1);
  const prev = $derived([...heads].reverse().find(s => s.n < (cur ? cur.n : here)));
  const next = $derived(heads.find(s => s.n > here));
  const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"); // i18n-ignore
  const goSection = (s?: { n: number }) => s && document.getElementById("s" + s.n)?.scrollIntoView({ block: "start", behavior: smooth() });
</script>

<svelte:window bind:scrollY />

<div class="vpos" id="vpos" hidden={!shown}>
  <button
    type="button"
    id="sec-prev"
    aria-label={t("reader.section_prev")}
    hidden={!arrows}
    disabled={!prev}
    onclick={() => goSection(prev)}>‹</button
  ><span id="vpos-t">{cur ? `${cur.h} · ` : ""}{t("reader.verse_of", { v: here, last: reader.lastVerse })}</span><button
    type="button"
    id="sec-next"
    aria-label={t("reader.section_next")}
    hidden={!arrows}
    disabled={!next}
    onclick={() => goSection(next)}>›</button
  >
</div>
