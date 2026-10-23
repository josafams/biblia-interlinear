<!-- Small line icons (decorative: the button around them has the label). -->
<script lang="ts">
  let { name, size = 20 }: { name: "note" | "close"; size?: number } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width={name === "close" ? 2 : 1.8}
  stroke-linecap="round"
  aria-hidden="true"
>
  {#if name === "note"}<path d="M5 4h14v12l-4 4H5z" /><path d="M9 9h6M9 13h4" />{:else}<path d="M6 6l12 12M18 6L6 18" />{/if}
</svg>
