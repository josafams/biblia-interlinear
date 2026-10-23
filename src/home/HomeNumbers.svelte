<!-- The numbers of the project (section.nums): books, chapters, verses, words and lexicon entries. -->
<script lang="ts">
  import { t } from "../i18n";
  import type { HomeData } from "./data";

  let { counts }: { counts: HomeData["counts"] } = $props();
  const ROWS = ["books", "chapters", "verses", "words", "entries"] as const;
</script>

{#each ROWS as k (k)}<div><b>{counts[k].toLocaleString("pt-BR")}</b><span>{t(`home.numbers.${k}`)}</span></div>{/each}
