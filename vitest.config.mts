// Unit tests of src/lib and src/i18n (no browser): npm run test:unit
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["tests/unit/**/*.test.ts"], environment: "node" } });
