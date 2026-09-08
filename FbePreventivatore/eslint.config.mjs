import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worker di pdf.js minificato, copiato da node_modules da `npm run
    // copia-worker-pdf` (predev/prebuild): non è codice sorgente del progetto.
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
