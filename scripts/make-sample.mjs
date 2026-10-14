// Generates samples/sample-report.pdf and samples/sample-report.txt from the same fake data.
// The PDF mimics a typical exported table: title + date, header row repeated per page,
// right-aligned money columns (including the "Today's Rev" column the app must ignore) and a page footer.
//
//   npm run sample
import { writeFileSync, mkdirSync } from 'node:fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const DATE = '10/13/2026'

const rows = [
  ['Sarah Johnson', 'John Doe', 'A-10231', 'Pending Install', '$1,250.00', '$0.00'],
  ['Sarah Johnson', 'Maria Garcia', 'A-10244', 'Install Pending', '$950.00', '$0.00'],
  ['Sarah Johnson', 'Robert Lee', 'A-10187', 'Canceled', '$700.00', '-$700.00'],
  ['Sarah Johnson', 'Linda Park', 'A-10199', 'Installed', '$1,400.00', '$1,400.00'],
  ['Mike Anderson', 'James Wilson', 'A-10302', 'Scheduled', '$1,100.00', '$0.00'],
  ['Mike Anderson', 'Paul Turner', 'A-10311', 'Active', '$820.00', '$820.00'],
  ['Priya Patel', 'Kevin Brooks', 'A-10405', 'Pending Installation', '$2,300.00', '$0.00'],
  ['Priya Patel', 'Amanda Ross', 'A-10412', 'Cancelled', '$1,050.00', '-$1,050.00'],
  ['Priya Patel', 'Diego Ramirez', 'A-10419', 'Customer Canceled', '$480.00', '-$480.00'],
  ['Priya Patel', 'Grace Kim', 'A-10423', 'Awaiting Install', '', '$0.00'],
  ['Carlos Mendez', 'Olivia Chen', 'A-10501', 'pending install', '$675.50', '$0.00'],
  ['Carlos Mendez', 'Ethan Moore', 'A-10507', 'CANCELED INSTALL', '$1,320.00', '-$1,320.00'],
  ['Carlos Mendez', 'Sophia Hall', 'A-10512', 'Installed', '$990.00', '$990.00'],
  ['Jasmine Wright', 'Noah Allen', 'A-10601', 'Pending', '$1,875.00', '$0.00'],
  ['Jasmine Wright', 'Emma Scott', 'A-10606', 'Cancel', '$560.00', '-$560.00'],
  ['Jasmine Wright', 'Liam Young', 'A-10610', 'Pending Install', '$2,040.00', '$0.00'],
  ['Mike Anderson', 'Ava King', 'A-10322', 'Installed', '$1,210.00', '$1,210.00'],
  ['Carlos Mendez', 'Mason Green', 'A-10519', 'Pending Install', '$1,150.00', '$0.00'],
]

const header = ['Agent', 'Customer', 'Account ID', 'Status', 'Revenue', "Today's Rev"]
// [x, align] per column; money columns are right-aligned to x.
const columns = [
  [40, 'left'],
  [160, 'left'],
  [280, 'left'],
  [360, 'left'],
  [520, 'right'],
  [590, 'right'],
]

mkdirSync('samples', { recursive: true })

// ---------- PDF ----------
const pdf = await PDFDocument.create()
const font = await pdf.embedFont(StandardFonts.Helvetica)
const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
const size = 9
const rowsPerPage = 12
const pages = Math.ceil(rows.length / rowsPerPage)

const draw = (page, text, col, y, f = font) => {
  const [x, align] = columns[col]
  const width = f.widthOfTextAtSize(text, size)
  page.drawText(text, { x: align === 'right' ? x - width : x, y, size, font: f })
}

for (let p = 0; p < pages; p++) {
  const page = pdf.addPage([612, 792])
  page.drawText('Daily Sales Status Report', { x: 40, y: 740, size: 14, font: bold })
  page.drawText(`Report Date: ${DATE}`, { x: 40, y: 722, size: 10, font })

  let y = 690
  header.forEach((h, i) => draw(page, h, i, y, bold))
  page.drawLine({ start: { x: 40, y: y - 4 }, end: { x: 592, y: y - 4 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) })

  for (const row of rows.slice(p * rowsPerPage, (p + 1) * rowsPerPage)) {
    y -= 18
    row.forEach((cell, i) => cell && draw(page, cell, i, y))
  }

  if (p === pages - 1) {
    y -= 26
    page.drawText('Total', { x: 40, y, size, font: bold })
    draw(page, '$22,895.50', 4, y, bold)
  }
  page.drawText(`Page ${p + 1} of ${pages}`, { x: 280, y: 30, size: 8, font })
}

writeFileSync('samples/sample-report.pdf', await pdf.save())

// ---------- TXT (fixed-width, columns separated by 2+ spaces) ----------
const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)) + 3)
const fmt = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('').trimEnd()
const txt = [
  'Daily Sales Status Report',
  `Report Date: ${DATE}`,
  '',
  fmt(header),
  ...rows.map((r) => fmt(r.map((c) => c || ' '))),
  '',
  'Total                                                               $22,895.50',
  '',
].join('\n')
writeFileSync('samples/sample-report.txt', txt)

console.log(`Wrote samples/sample-report.pdf (${pages} pages) and samples/sample-report.txt (${rows.length} rows)`)
