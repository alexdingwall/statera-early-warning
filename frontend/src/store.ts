import { create } from "zustand"
import type { Bundle } from "@/types"

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
  load: () => Promise<void>
  setAsOf: (d: string) => void
  setGroundTruth: (v: boolean) => void
  setPlaying: (v: boolean) => void
  openDrawer: (d: DrawerState | null) => void
}

export const DEFAULT_AS_OF = "2025-03-21"

export const useStore = create<State>((set) => ({
  bundle: null,
  error: null,
  asOf: DEFAULT_AS_OF,
  groundTruth: false,
  playing: false,
  drawer: null,
  load: async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/bundle.json`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const bundle = (await res.json()) as Bundle
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
  setGroundTruth: (groundTruth) => set({ groundTruth }),
  setPlaying: (playing) => set({ playing }),
  openDrawer: (drawer) => set({ drawer }),
}))
