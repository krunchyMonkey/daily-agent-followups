export type StatusBucket = 'pendingInstall' | 'canceled'

/** Lower-case, punctuation to spaces, collapse whitespace: " Install-Pending! " -> "install pending". */
export function normalizeStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

// TODO(real-pdf): extend these lists with the exact status strings that appear in the report owner's report.
const CANCELED_PATTERNS = [/\bcancel/, /\bcancell?ed\b/]
const PENDING_PATTERNS = [/\bpending\b/, /\bscheduled\b/, /\bawaiting install/]

/**
 * Buckets a status. Cancel wins over pending so "Canceled Install" or "Pending Cancel" is treated as canceled.
 * Returns null for statuses that belong in neither list (e.g. "Installed", "Active").
 */
export function classifyStatus(status: string): StatusBucket | null {
  const s = normalizeStatus(status)
  if (!s) return null
  if (CANCELED_PATTERNS.some((p) => p.test(s))) return 'canceled'
  if (PENDING_PATTERNS.some((p) => p.test(s))) return 'pendingInstall'
  return null
}
