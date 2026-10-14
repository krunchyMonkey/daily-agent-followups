# Future: Microsoft Teams automation (Phase 2)

> **Out of scope for V1.** The first version deliberately stops at copy/paste and `.txt` export. Ryan reviews the output and sends the messages himself. This document describes the next phase so the V1 design leaves room for it.

## Target workflow

```text
Ryan uploads PDF
        ↓
App parses PDF
        ↓
Ryan previews output
        ↓
Ryan clicks Send to Teams
        ↓
Each agent receives only their own Pending Install and Canceled list
```

V1 already produces the per-agent message text (`formatAgentMessage` in `src/parser/formatReport.ts`). Phase 2 is about **delivery**, not parsing.

## Requirements

### 1. Microsoft Teams authentication
- Use Microsoft Graph with an Entra ID (Azure AD) app registration.
- Prefer **delegated** auth, signed in as Ryan, so messages come from him. That needs the `Chat.Create`, `ChatMessage.Send` and `User.ReadBasic.All` scopes.
- Use the MSAL device-code or auth-code flow from the Electron main process. Keep tokens in the OS credential store (for example via `safeStorage`). **Never** hard-code secrets or commit them.
- Alternatives to evaluate: a Teams bot (proactive messages) or Power Automate / Workflows if Graph permissions are restricted by IT.

### 2. Agent → Teams user mapping
- Map the name in the PDF ("Sarah Johnson") to a Teams user (UPN / email / Entra object id).
- Keep it in an editable local file (e.g. `agents.json`) with a small settings screen.
- Flag unmapped agents and `Unknown Agent` loudly. They are never sent automatically.

### 3. Preview / dry-run mode
- Show exactly who will receive what before anything is sent.
- Add a dry-run toggle that logs the payloads without calling Graph.

### 4. Send confirmation
- Require one explicit confirmation listing the recipient count, e.g. "Send 12 messages?".
- Allow sending to a selected subset of agents only.

### 5. Failure / retry logging
- Track per-agent status: queued, sent or failed, with the error message.
- Retry with backoff on throttling (HTTP 429, honouring Retry-After) and on transient 5xx errors.
- Offer a "Retry failed" button. Never resend to agents that already got the message for that report date.

### 6. Daily scheduling
- Optionally watch a folder, or prompt at a set time each morning.
- Keep a human in the loop. Even when scheduled, the default is preview-then-send, not unattended sending.

### 7. Audit log
- Record date, report file hash, recipient, message hash, timestamp, result and sender.
- Store it locally (JSON lines or SQLite). Keep it append-only and make it easy to export.

## Design notes

- Put a `MessageSender` interface beside the parser (`send(agent, text): Promise<Result>`) with `ClipboardSender` (today) and `TeamsSender` implementations, so the UI doesn't change much.
- Keep the Graph calls in the Electron main process. The renderer only gets `send`, `status` and `cancel` through the preload bridge, the same as the clipboard and save-file calls today.
- Each agent must only ever receive their own block. Unit-test the grouping-to-recipient step before enabling sends.
