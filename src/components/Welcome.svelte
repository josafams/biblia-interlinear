<!-- First opening (#welcome, in the chapter header): how the person wants to read. "Depois" keeps Interlinear. -->
<script lang="ts">
  import { t } from "../i18n";
  import { reader } from "../state/reader.svelte";

  let { onpick }: { onpick: (mode: "biblia" | "original" | "interlinear" | "") => void } = $props();
  const MODES = ["biblia", "original", "interlinear"] as const;
</script>

<div class="welcome" id="welcome" data-testid="welcome" hidden={!reader.welcome} role="region" aria-labelledby="welcome-h">
  <p id="welcome-h"><b>{t("welcome.title")}</b> <span>{t("welcome.hint")}</span></p>
  <div class="wopts">
    {#each MODES as id (id)}<button type="button" data-modo={id} onclick={() => onpick(id)}>{t(`modes.${id}.name`)}</button>{/each}
    <button type="button" class="later" data-modo="" onclick={() => onpick("")}>{t("welcome.later")}</button>
  </div>
</div>
