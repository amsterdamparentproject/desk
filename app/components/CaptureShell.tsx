'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LavaLoader } from './Lava'

// Suspense fallback while BoardWithData fetches from Supabase. It used to be an
// old capture-only layout with empty columns, which read as "no rows" whenever
// the data was slow or the stream stalled. Now it is honest about loading, and
// if the board still has not arrived after a few seconds it asks the server
// again on its own (a few times), then offers a manual reload.
export function CaptureShell() {
  const router = useRouter()
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    let attempts = 0
    const t = setInterval(() => {
      attempts += 1
      router.refresh()
      if (attempts >= 3) {
        clearInterval(t)
        setStalled(true)
      }
    }, 8000)
    return () => clearInterval(t)
  }, [router])

  return (
    <main className="flex flex-1 items-center justify-center bg-base p-4">
      <div className="w-full max-w-md space-y-4">
        <LavaLoader message="Fetching your rows…" delay={0.4} />
        {stalled && (
          <div className="text-center">
            <p className="mb-2 text-sm font-semibold text-slate-500">
              This is taking longer than usual.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border-2 border-app-gold px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-300 transition-colors hover:bg-app-gold hover:text-ink"
            >
              Reload
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
