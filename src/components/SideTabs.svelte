<!-- Computer: the tabs Verbete · Anotar · Aparência on top of the panel beside the text (#ptabs). -->
<script lang="ts">
  import { t } from "../i18n";
  import { annotate } from "../state/annotate.svelte";
  import { entry } from "../state/entry.svelte";
  import { side } from "../state/layout.svelte";
  import { ui } from "../state/ui.svelte";

  type Tab = "verbete" | "anotar" | "aparencia";
  let { onpick }: { onpick: (tab: Tab) => void } = $props();
  const TABS = [
    ["verbete", "side.entry"],
    ["anotar", "side.annotate"],
    ["aparencia", "bar.look"]
  ] as const;
  const open = $derived<Tab | "">(entry.open ? "verbete" : annotate.open ? "anotar" : ui.sheet === "look" && side.on ? "aparencia" : "");
</script>

<nav id="ptabs" class="ptabs" aria-label={t("side.label")}>
  {#each TABS as [id, label] (id)}<button type="button" data-ptab={id} aria-pressed={open === id} onclick={() => open !== id && onpick(id)}
      >{t(label)}</button
    >{/each}
</nav>
