<!--
  ‹ › to the previous or next chapter: in the top bar (computer, an icon) and in the bottom bar
  (phone, with "Jo 4" under the arrow). Disabled at the first and the last chapter of the Bible.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { reader } from "../state/reader.svelte";

  let { dir, place, ongo }: { dir: -1 | 1; place: "top" | "bottom"; ongo: (dir: -1 | 1) => void } = $props();
  const target = $derived(dir < 0 ? reader.prev : reader.next);
  const label = $derived(target ? t(dir < 0 ? "bar.prev_chapter" : "bar.next_chapter", { ref: `${target.name} ${target.n}` }) : "");
</script>

<button
  type="button"
  id={(place === "top" ? "bar-" : "bb-") + (dir < 0 ? "prev" : "next")}
  class={place === "top" ? "ibtn icon wide-only" : undefined}
  data-dir={dir}
  data-testid={dir < 0 ? "prev-chapter" : "next-chapter"}
  aria-label={label || t(dir < 0 ? "bar.first_chapter" : "bar.last_chapter")}
  aria-disabled={!target}
  title={label}
  onclick={() => ongo(dir)}
>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"><path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} /></svg
  >{#if place === "bottom"}<span class="bb-t">{target ? `${target.abbrev} ${target.n}` : ""}</span>{/if}
</button>
