<!--
  A question with buttons over the page (src/state/ask.svelte.ts). Esc or a tap outside cancels; the focus goes
  to the main button and back to where it was when the question closes.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { answerAsk, askView as v } from "../state/ask.svelte";

  let box: HTMLElement | undefined = $state();
  let returnFocus: Element | null = null;
  $effect(() => {
    if (!v.open) return;
    returnFocus = document.activeElement;
    tick().then(() => (box?.querySelector<HTMLElement>("button.prim") || box?.querySelector<HTMLElement>("button"))?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      answerAsk("");
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  });
</script>

{#if v.open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="account-modal" onclick={e => e.target === e.currentTarget && answerAsk("")}>
    <div class="account-box" role="alertdialog" aria-modal="true" aria-labelledby="cm-t" aria-describedby="cm-x" bind:this={box}>
      <h2 id="cm-t">{v.title}</h2>
      <p id="cm-x">{v.text}</p>
      <div class="account-actions">
        {#each v.buttons as b (b.id)}<button data-r={b.id} class:prim={b.prim} class:perigo={b.perigo} onclick={() => answerAsk(b.id)}
            >{b.texto}</button
          >{/each}
      </div>
    </div>
  </div>
{/if}
