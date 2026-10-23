<!-- The thin line under the top bar: how much of the chapter has gone by on the screen. -->
<script lang="ts">
  import { chapter } from "../state/chapter.svelte";

  let width = $state("0%");
  let frame = 0;
  function update() {
    frame = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    width = (max > 0 ? Math.min(100, (scrollY / max) * 100) : 0).toFixed(1) + "%";
  }
  const later = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  $effect(() => {
    void chapter.renderId;
    later();
  });
</script>

<svelte:window onscroll={later} onresize={later} />

<div class="readbar" aria-hidden="true"><span id="readbar" style:width></span></div>
