# Daily Agent Follow-Ups

A small desktop app that turns the report owner's daily PDF report into clean, copy-pasteable follow-up messages for each sales agent.

Drop in the PDF. You get one block per agent listing their **Pending Install** and **Canceled** accounts with revenue, ready to paste into Teams.

## What problem it solves

The daily report arrives as one long PDF table. Following up with every agent meant reading it row by row and retyping each agent's list. This app does that grouping in seconds:

- It splits the report **by agent**.
- It builds two lists per agent, **Pending Install** and **Canceled**, each with **revenue**.
- It **drops the "Today's Rev" column** entirely.
- It produces text you can **copy** (the whole report or a single agent's message) or **export to .txt**.

Everything runs locally. The PDF is parsed on your computer and nothing is uploaded anywhere.

## Install

Requires [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
```

## Run

```bash
npm run electron:dev   # desktop app with hot reload (starts Vite + Electron)
```

or just the UI in a browser:

```bash
npm run dev            # http://127.0.0.1:5173. Copy and Export use browser fallbacks.
```

## Build

```bash
npm run build          # type-checks, builds the UI to dist/ and the Electron main process to dist-electron/
npm start              # runs the built desktop app
```

Other scripts:

```bash
npm test               # parser unit tests, including both sample files
npm run typecheck
npm run sample         # regenerates samples/sample-report.pdf and .txt
```

> Packaging into a Windows installer (`electron-builder`) is not set up yet. See the TODOs below.

## Using it

1. Open the app.
2. Drag the daily report PDF onto the drop zone, or click it to choose a file.
3. Click **Generate Report**.
4. Check the preview. The report date is taken from the PDF when one is found, and you can change it.
5. Click **Copy Full Report**, **Copy Agent Message** on any agent card, or **Export TXT**.

To check what the parser actually read, open **Show extracted rows** at the bottom of the page.

## Expected PDF format

The first-pass parser expects a **text-based PDF** (one exported from a system, not a scan) that contains a table with a header row. Header names are matched loosely:

| Meaning | Accepted headers (case/punctuation-insensitive) |
|---|---|
| Agent | `Agent`, `Agent Name`, `Sales Agent`, `Sales Rep`, `Rep` |
| Customer | `Customer`, `Customer Name`, `Client` |
| Account | `Account`, `Account ID`, `Account #`, `Acct` |
| Status | `Status`, `Order Status`, `Install Status` |
| Revenue | `Revenue`, `Rev`, `Total Rev` |
| **Ignored** | `Today's Rev`, `Today’s Rev`, `Today Rev`, `todays_rev` |

The header must include **Status** plus at least one other recognized column. The parser also handles:

- headers repeated on every page;
- reports grouped under `Agent: Sarah Johnson` headings instead of an agent column;
- totals rows and "Page X of Y" footers, which are skipped;
- blank revenue cells. These show `Revenue: Unknown`, and the value from the neighbouring Today's Rev column is never picked up instead.

Status buckets:

- **Pending Install:** `Pending Install`, `Pending`, `Install Pending`, `Pending Installation`, `Scheduled`, `Awaiting Install`
- **Canceled:** `Canceled`, `Cancelled`, `Cancel`, `Customer Canceled`, `Canceled Install`
- Anything else (for example `Installed`, `Active`) is left out of the output. The preview shows how many rows were skipped.

Sorting: agents A–Z (with `Unknown Agent` last), Pending Install before Canceled, and highest revenue first within each list, with missing revenue at the end.

`.txt`, `.csv` and `.tsv` exports of the same table are accepted too, which helps when a PDF won't parse.

Try it with [`samples/sample-report.pdf`](samples/sample-report.pdf) or [`samples/sample-report.txt`](samples/sample-report.txt).

## Example output

Full report:

```text
DAILY FOLLOW-UP REPORT
Date: 2026-10-13

Agent: Mike Anderson

Pending Install:
1. James Wilson - Revenue: $1,100

Canceled:
None


Agent: Sarah Johnson

Pending Install:
1. John Doe - Revenue: $1,250
2. Maria Garcia - Revenue: $950

Canceled:
1. Robert Lee - Revenue: $700
```

Per-agent message (the **Copy Agent Message** button):

```text
Hey Sarah, here’s your follow-up list for today.

Pending Install:
1. John Doe - Revenue: $1,250
2. Maria Garcia - Revenue: $950

Canceled:
1. Robert Lee - Revenue: $700
```

## Current first-pass limitations

- **Not yet tested against the report owner's real PDF.** The parser was built against a realistic sample. Header names, status values and column spacing may need small tweaks once we see the real file. Those spots are marked `TODO(real-pdf)` in `src/parser/`.
- **Scanned or image-only PDFs are not supported** (there's no OCR). They show: *"Unable to extract usable data from the PDF…"*
- **Table layouts are expected.** Free-form text, or rows that wrap across several lines, are not reassembled.
- When there is no customer name, the item falls back to `Account <id>`. If there is neither, it shows `Unknown Customer`.
- There is no installer yet. You run it with Node (`npm start`).
- There is no Teams integration. You copy and paste by hand for now (see below).

## How it works

```
PDF ──pdf.js──▶ positioned text ──▶ lines & cells ──▶ header detection + column alignment ──▶ ReportRow[]
                                                                                                │
                              copy / export ◀── formatReport ◀── group by agent + classify status
```

| File | Role |
|---|---|
| `src/parser/parsePdf.ts` | pdf.js text extraction and line/cell reconstruction; entry point `parseReportFile` |
| `src/parser/parseText.ts` | `.txt` / `.csv` / `.tsv` input |
| `src/parser/extractRows.ts` | header detection, column alignment, agent headings, noise lines → `ReportRow[]` |
| `src/parser/normalizeColumns.ts` | header aliases, ignored columns, revenue parsing |
| `src/parser/classifyStatus.ts` | Pending Install / Canceled buckets |
| `src/parser/formatReport.ts` | grouping, sorting and the exact output text |
| `electron/main.ts`, `electron/preload.ts` | window, clipboard and Save dialog (the only desktop capabilities exposed) |
| `src/components/*` | drop zone, report preview, agent cards |

The parser is plain TypeScript with no UI or Electron dependencies, so it can be unit-tested directly (`tests/parser.test.ts`). It could also be swapped for a Python parser later behind the same `ParseResult` shape.

## TODO

- [ ] Run against the report owner's real PDF and tune `TODO(real-pdf)` spots (header aliases, statuses, line/cell tolerances).
- [ ] Handle rows that wrap onto two lines, if the real report has them.
- [ ] Package a Windows installer with `electron-builder`.
- [ ] Optional OCR fallback for scanned PDFs.
- [ ] Phase 2: Teams automation ([docs/FUTURE_TEAMS_AUTOMATION.md](docs/FUTURE_TEAMS_AUTOMATION.md)).

## Future: Teams automation

The long-term goal is to send each agent their own list through Microsoft Teams every day. That is **intentionally out of scope for V1**. The plan (auth, agent-to-Teams-user mapping, dry run, send confirmation, retries, scheduling, audit log) is written up in [docs/FUTURE_TEAMS_AUTOMATION.md](docs/FUTURE_TEAMS_AUTOMATION.md).

## Troubleshooting

- **`TypeError: Cannot read properties of undefined (reading 'handle')` when starting Electron.** Your terminal has `ELECTRON_RUN_AS_NODE` set (VS Code's terminal does). `npm start` and `npm run electron:dev` already clear it. If you run `electron .` directly, unset it first.
