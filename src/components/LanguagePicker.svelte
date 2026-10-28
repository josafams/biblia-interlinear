<!--
  The language of the app (in Aparência): one chip per locale; picking one saves it and reloads the page in it.
-->
<script lang="ts">
  import { chooseLocale, getLocale, LOCALE_IDS, t } from "../i18n";
</script>

<div class="sgroup" role="group" aria-labelledby="g-lang">
  <h3 id="g-lang">{t("language.label")}</h3>
  <div class="chks chips" id="lang-pick">
    {#each LOCALE_IDS as id (id)}
      <button class="chip" data-lang={id} lang={id} aria-pressed={getLocale() === id} onclick={() => getLocale() !== id && chooseLocale(id)}
        >{t(`language.names.${id}`)}</button
      >
    {/each}
  </div>
</div>
