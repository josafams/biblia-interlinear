<!-- " · N" after "Notas" in the index tab: verses with an annotation. -->
<script lang="ts">
  import { annotated } from "../state/annotations.svelte";
</script>

{annotated.verses ? ` · ${annotated.verses}` : ""}
