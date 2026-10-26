import { create } from "zustand"
import type { Bundle } from "@/types"

import type { ActionState } from "@/lib/actions"

export const API = "http://localhost:8000"

export interface ActionRecord { state: ActionState; on: string }

export interface DrawerState {
  docId: string
  span?: [number, number] | null
}

interface State {
  bundle: Bundle | null
  error: string | null
  asOf: string
  groundTruth: boolean
  playing: boolean
  drawer: DrawerState | null
  actions: Record<string, ActionRecord>
  setAction: (issueId: string, rec: ActionRecord | null) => void
  load: () => Promise<void>
  setAsOf: (d: string) => void
  setGroundTruth: (v: boolean) => void
  setPlaying: (v: boolean) => void
  setBundle: (b: Bundle) => void
  openDrawer: (d: DrawerState | null) => void
}

function readActions(): Record<string, ActionRecord> {
  try { return JSON.parse(localStorage.getItem("ew-actions") ?? "{}") } catch { return {} }
}

export const DEFAULT_AS_OF = "2025-03-21"

export const useStore = create<State>((set) => ({
  bundle: null,
  error: null,
  asOf: DEFAULT_AS_OF,
  groundTruth: false,
  playing: false,
  drawer: null,
  actions: readActions(),
  setAction: (issueId, rec) =>
    set((s) => {
      const next = { ...s.actions }
      if (rec) next[issueId] = rec; else delete next[issueId]
      try { localStorage.setItem("ew-actions", JSON.stringify(next)) } catch { /* storage unavailable */ }
      return { actions: next }
    }),
  load: async () => {
    try {
      // When the local backend is running it holds the latest build, including any report added since the site was built.
      const live = await fetch(`${API}/api/bundle`, { signal: AbortSignal.timeout(800) }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      const res = live ? null : await fetch(`${import.meta.env.BASE_URL}data/bundle.json`)
      if (res && !res.ok) throw new Error(`HTTP ${res.status}`)
      const bundle = (live ?? (await res!.json())) as Bundle
      // Deep links for demos and screenshots: #/path?asof=2025-06-30&gt=1
      const q = new URLSearchParams(window.location.hash.split("?")[1] ?? "")
      const asof = q.get("asof")
      set({
        bundle,
        ...(asof && /^\d{4}-\d{2}-\d{2}$/.test(asof) ? { asOf: asof } : {}),
        ...(q.get("gt") === "1" ? { groundTruth: true } : {}),
      })
    } catch (e) {
      set({ error: `Could not load data/bundle.json (${String(e)})` })
    }
  },
  setAsOf: (asOf) => set({ asOf }),
  setBundle: (bundle) => set({ bundle }),
  setGroundTruth: (groundTruth) => set({ groundTruth }),
  setPlaying: (playing) => set({ playing }),
  openDrawer: (drawer) => set({ drawer }),
}))
