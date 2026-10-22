// Which panel is open. More panels move here as their components arrive (phase 4).
export type Sheet = "toc" | "look";

export const ui = $state({ sheet: null as Sheet | null });
