import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PdfJs } from '../parser/parsePdf'

// pdf.js parses in a web worker; Vite bundles the worker file and gives us its URL. Nothing leaves the machine.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export const pdfjs = pdfjsLib as unknown as PdfJs
