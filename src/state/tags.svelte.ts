// "Gerenciar etiquetas" in Minhas anotações.
import type { Tag } from "../lib/annotations/verse";

export const tagManager = $state({ open: false, tags: [] as Tag[] });
