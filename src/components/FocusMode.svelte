<!--
  Modo de foco (Aparência › Texto): scrolling down hides the bars (body.barras-fora); scrolling up or opening
  a panel brings them back. No markup.
-->
<script lang="ts">
  import { annotate } from "../state/annotate.svelte";
  import { entry } from "../state/entry.svelte";
  import { prefs } from "../state/prefs.svelte";
  import { ui } from "../state/ui.svelte";

  let lastY = 0;
  const panel = $derived(entry.open || annotate.open || ui.sheet !== null);
  function onscroll() {
    const y = scrollY,
      dy = y - lastY;
    if (Math.abs(dy) < 8) return;
    lastY = y;
    document.body.classList.toggle("barras-fora", prefs.values["t-foco"] && dy > 0 && y > 200 && !panel);
  }
  $effect(() => {
    if (panel || !prefs.values["t-foco"]) document.body.classList.remove("barras-fora");
  });
</script>

<svelte:window {onscroll} />
