import { AlertTriangle, XCircle } from 'lucide-react'
import type { DeskActivity } from '../../types/activity'

/**
 * Shows why the AI parse failed (red) or what to double-check after a
 * successful one (amber). Renders nothing for a clean card.
 */
export function ParseNotice({
  activity,
  compact = false,
  onDismiss,
}: {
  activity: Pick<DeskActivity, 'parse_error' | 'parse_warnings' | 'status'>
  compact?: boolean
  onDismiss?: () => void
}) {
  if (activity.status === 'processing') return null
  const warnings = activity.parse_warnings ?? []
  if (!activity.parse_error && warnings.length === 0) return null

  const visible = compact ? warnings.slice(0, 2) : warnings
  const hidden = warnings.length - visible.length

  return (
    <div className="space-y-1" data-testid="parse-notice">
      {activity.parse_error && (
        <div className="flex items-start gap-1.5 text-red-700 bg-red-50 rounded px-1.5 py-1">
          <XCircle size={12} className="mt-0.5 shrink-0" />
          <span className="text-[10px] font-bold leading-snug">
            {activity.parse_error}
          </span>
        </div>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-[10px] font-black uppercase tracking-wide text-slate-400 hover:text-slate-700"
        >
          Dismiss notes
        </button>
      )}
      {visible.length > 0 && (
        <div className="flex items-start gap-1.5 text-amber-800 bg-amber-50 rounded px-1.5 py-1">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <ul className="text-[10px] font-bold leading-snug space-y-0.5">
            {visible.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {hidden > 0 && <li>+{hidden} more in Edit</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
