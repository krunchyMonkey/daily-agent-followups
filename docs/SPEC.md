# Spec: Daily Agent Follow-Up PDF Tool (V1)

The original first-pass specification this repo implements.

## Task

Build a first-pass desktop app that converts Ryan's daily PDF report into copy-pasteable agent follow-up messages.

## Context

Ryan has a daily PDF report that he wants transformed into clean follow-up text for sales agents.

Requested output:

- Break the PDF up by agent name.
- For each agent, create two lists: **Pending Install** and **Canceled**.
- Include revenue for each item.
- Ignore/remove the "Today's Rev" column.
- First pass should generate text that Ryan can copy/paste.
- Long-term goal is to PM each agent daily through Microsoft Teams.

For now, build the first pass only.

## Goal

A working first-pass desktop app that lets Ryan:

1. Open the app.
2. Drag/drop or select a PDF.
3. Parse the PDF locally.
4. Generate a grouped report by agent.
5. Copy the full report or copy an individual agent's message.
6. Export the result as a `.txt` file.

Teams automation is not implemented yet; it is a future enhancement.

## Stack

Electron, React, Vite, TypeScript, Node.js, and a practical PDF text-extraction library (this repo uses pdf.js). If Node-based PDF parsing proves unreliable, the parser should be swappable (e.g. for a Python parser) without over-engineering the first pass.

## Main workflow

```text
User opens app
        ↓
User drags in PDF or chooses file
        ↓
App parses PDF
        ↓
App extracts rows
        ↓
App groups rows by agent
        ↓
App shows grouped text output
        ↓
User copies full report, copies one agent block, or exports .txt
```

## UI requirements

- App title: `Daily Agent Follow-Ups`
- PDF upload/drop zone
- `Generate Report` button
- Error display area
- Full generated report preview
- Agent-by-agent cards/sections
- `Copy Full Report` button
- `Copy Agent Message` button per agent
- `Export TXT` button

Plain but usable styling.

## Output format

```text
DAILY FOLLOW-UP REPORT
Date: 2026-10-13

Agent: Sarah Johnson

Pending Install:
1. John Doe - Revenue: $1,250
2. Maria Garcia - Revenue: $950

Canceled:
1. Robert Lee - Revenue: $700


Agent: Mike Anderson

Pending Install:
1. James Wilson - Revenue: $1,100

Canceled:
None
```

Per-agent Teams-style block:

```text
Hey Sarah, here’s your follow-up list for today.

Pending Install:
1. John Doe - Revenue: $1,250
2. Maria Garcia - Revenue: $950

Canceled:
1. Robert Lee - Revenue: $700
```

## Data shapes

```ts
type ReportRow = {
  agentName: string;
  customerName?: string;
  accountId?: string;
  status: string;
  revenue?: number;
  raw?: Record<string, string>;
};

type AgentFollowUp = {
  agentName: string;
  pendingInstall: ReportRow[];
  canceled: ReportRow[];
};
```

## Status classification

**Pending Install:** Pending Install, Pending, Install Pending, Pending Installation, Scheduled, Awaiting Install.

**Canceled:** Canceled, Cancelled, Cancel, Customer Canceled, Canceled Install.

Matching is case-insensitive, whitespace-tolerant and punctuation-tolerant where practical. Rows that match neither bucket are skipped.

## Column handling

| Header | Field |
|---|---|
| Agent, Agent Name, Sales Agent | `agentName` |
| Customer, Customer Name | `customerName` |
| Account, Account ID | `accountId` |
| Revenue, Rev | `revenue` |
| Status | `status` |

Explicitly ignored: `Today’s Rev`, `Today's Rev`, `Today Rev`, `todays_rev`.

## Sorting

1. Agents alphabetically.
2. Pending Install before Canceled.
3. Within each list, revenue descending.
4. Rows with missing revenue last.

## Error handling

| Situation | Message |
|---|---|
| PDF parsing fails | Unable to extract usable data from the PDF. The PDF may be scanned, image-based, or formatted in a way this first-pass parser does not support yet. |
| Agent name missing | `Unknown Agent` |
| Revenue missing | `Revenue: Unknown` |
| No matching rows | No Pending Install or Canceled rows were found in this PDF. |

## Priorities

Prioritize clean architecture, easy-to-edit parser logic, clear TODO comments, a good README, a working UI shell and the manual copy/paste workflow.

Do not prioritize Teams integration, authentication, cloud hosting, scheduling, database storage, complex OCR or multi-user support.

## Future Teams automation

See [FUTURE_TEAMS_AUTOMATION.md](FUTURE_TEAMS_AUTOMATION.md). Intentionally out of scope for V1.

## Acceptance criteria

- A public GitHub repo exists.
- The repo has a working Electron + React app scaffold.
- The app can select or drag/drop a PDF.
- The app attempts to parse the PDF locally.
- Parsed rows are grouped by agent.
- Output contains Pending Install and Canceled sections.
- Output includes revenue.
- Output excludes Today's Rev.
- User can copy the full report.
- User can copy a single agent's message.
- User can export the full report as `.txt`.
- README explains setup and current limitations.
- Teams automation is documented as future work, not implemented.
