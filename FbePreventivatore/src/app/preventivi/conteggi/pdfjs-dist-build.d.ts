// pdfjs-dist 5.6.205 non pubblica un .d.mts accanto a `build/pdf.mjs`: lo fa
// solo per `legacy/build/pdf.mjs` (che infatti contiene esattamente
// `export * from "pdfjs-dist";`). Senza questo shim, l'import in leggi-pdf.ts
// fallisce con TS7016 perche' il sottopercorso non ha dichiarazioni proprie.
declare module 'pdfjs-dist/build/pdf.mjs' {
  export * from 'pdfjs-dist'
}
