// template/spike/spike.ts
import fs from 'node:fs'
import path from 'node:path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

const percorsoMaster = path.resolve(import.meta.dirname, 'master-con-placeholder.docx')
const percorsoOutput = path.resolve(import.meta.dirname, 'output-spike.docx')

const contenuto = fs.readFileSync(percorsoMaster, 'binary')
const zip = new PizZip(contenuto)
const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

doc.render({
  cliente: 'Spike Test Cliente',
  totaleNetto: '300 000,00 €',
})

const buffer = doc.getZip().generate({ type: 'nodebuffer' })
fs.writeFileSync(percorsoOutput, buffer)
console.log('Scritto', percorsoOutput)
