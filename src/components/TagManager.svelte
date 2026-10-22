<!--
  "Gerenciar etiquetas" (inside #mn-tagmgr of Minhas anotações): rename a tag in its field (the name of another
  tag joins the two) or delete it (pressed twice).
-->
<script lang="ts">
  import { t } from "../i18n";
  import { tagManager } from "../state/tags.svelte";

  let {
    onrename,
    ondelete,
    ondone
  }: { onrename: (id: string, name: string) => Promise<void>; ondelete: (id: string) => void; ondone: () => void } = $props();
  // delete needs a second press within 4 s
  let armed: Record<string, number> = $state({});
  // after a rename (or a refused one: empty, unchanged) the field shows the tag's current name
  async function rename(id: string, field: HTMLInputElement) {
    await onrename(id, field.value);
    const now = tagManager.tags.find(x => x.id === id);
    if (now) field.value = now.nome;
  }
  function del(id: string) {
    if (Date.now() - (armed[id] || 0) > 4000) {
      armed[id] = Date.now();
      return;
    }
    delete armed[id];
    ondelete(id);
  }
</script>

{#if tagManager.open}
  <h3 class="mn-group">{t("tags.manage")}</h3>
  {#each tagManager.tags as tag (tag.id)}
    <div class="tm-row" data-id={tag.id}>
      <label class="sr" for="tm-{tag.id}">{t("tags.name_label", { tag: tag.nome })}</label>
      <input
        id="tm-{tag.id}"
        class="tm-name"
        type="text"
        value={tag.nome}
        autocomplete="off"
        onchange={e => rename(tag.id, e.currentTarget)}
      />
      <button class="chip tm-del" data-tm="del" onclick={() => del(tag.id)}>{t(armed[tag.id] ? "tags.delete_again" : "tags.delete")}</button
      >
    </div>
  {:else}
    <p class="mn-empty">{t("tags.none")}</p>
  {/each}
  <p class="tm-help">{t("tags.help")}</p>
  <button class="chip" data-tm="done" onclick={ondone}>{t("annotate.done")}</button>
{/if}
