import { useEffect, useMemo, useRef } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight, Keyboard, Pause, Play } from "lucide-react"
import { useStore } from "@/store"
import { addDays, daysBetween, fmtDate } from "@/lib/format"
import { alertsFired, docDates, replayDocs, statusOn } from "@/lib/selectors"
import { cn } from "@/lib/utils"
import { PROJECT_COLOUR, StatusDot } from "@/components/ui-bits"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SourceDrawer } from "@/components/SourceDrawer"
import { Help } from "@/components/Key"
import { OutcomeBanner } from "@/components/OutcomeBanner"

const JUMPS = [
  { label: "Start: the first report (31 Dec 2024)", date: "2024-12-31" },
  { label: "Ashfield first raises DNO date (21 Mar 2025)", date: "2025-03-21" },
  { label: "First warning (5 May 2025)", date: "2025-05-05" },
  { label: "Drumgarve site visit (30 May 2025)", date: "2025-05-30" },
  { label: "Ashfield board paper (30 Jun 2025)", date: "2025-06-30" },
  { label: "Ashfield slip reported (4 Jul 2025)", date: "2025-07-04" },
]

const NAV = [
  { to: "/", label: "Portfolio" },
  { to: "/project/ashfield", label: "Ashfield", project: "ashfield" },
  { to: "/project/drumgarve", label: "Drumgarve", project: "drumgarve" },
  { to: "/project/netherwood", label: "Netherwood", project: "netherwood" },
  { to: "/alerts", label: "Alerts" },
  { to: "/board", label: "Board check" },
  { to: "/evaluation", label: "Evaluation" },
  { to: "/sources", label: "Sources" },
  { to: "/add", label: "Add a report" },
]

export function Shell() {
  const bundle = useStore((s) => s.bundle)!
  const navigate = useNavigate()
  const { asOf, setAsOf, playing, setPlaying, groundTruth, setGroundTruth } = useStore()
  const dates = useMemo(() => docDates(bundle), [bundle])

  const step = (dir: 1 | -1) => {
    const cur = useStore.getState().asOf
    const next = dir === 1 ? dates.find((d) => d > cur) : [...dates].reverse().find((d) => d < cur)
    if (next) setAsOf(next)
    return !!next
  }

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      if (!step(1)) setPlaying(false)
    }, 2500)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) || e.metaKey || e.ctrlKey || e.altKey) return
      if (useStore.getState().drawer) return
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1) }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1) }
      else if (e.key === " ") {
        if (el.closest("button, a, summary, [role=tab]")) return   // Space keeps its normal job on a focused control
        e.preventDefault(); const s = useStore.getState(); s.setPlaying(!s.playing)
      }
      else if (e.key === "g" || e.key === "G") { const s = useStore.getState(); s.setGroundTruth(!s.groundTruth) }
      else if (/^[1-9]$/.test(e.key)) navigate(NAV[Number(e.key) - 1].to)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates])

  const recent = alertsFired(bundle, asOf).filter((a) => a.fired_on > addDays(asOf, -14)).length
  const badge = bundle.meta.source === "gold" ? "Gold labels" : "Pre-computed run"

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden max-lg:hidden">
        <header className="relative flex h-14 shrink-0 items-center justify-between bg-navy-900 px-5 text-white">
          <div className="flex items-baseline gap-3">
            <span className="font-heading text-[17px] font-semibold">Early Warning</span>
            <span className="label-caps text-blue-500">Project delivery</span>
          </div>
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger render={<span tabIndex={0} className="rounded-sm bg-white/10 px-2.5 py-1 text-[12px] text-white/90" />}>
                {badge}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Generated {bundle.meta.generated_at} · prompt {bundle.meta.prompt_version}
              </TooltipContent>
            </Tooltip>
            <Help />
            <Tooltip>
              <TooltipTrigger render={<button aria-label="Keyboard shortcuts" className="rounded-sm p-1.5 text-white/80 hover:bg-white/10" />}>
                <Keyboard size={16} />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-none flex-col items-start">
                <span>← → previous or next document</span>
                <span>Space play or pause</span>
                <span>G show what actually happened</span>
                <span>? how to use the app</span>
                <span>1 to 9 jump to a sidebar item</span>
                <span>Esc close the document drawer</span>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: "var(--gradient-brand)" }} />
        </header>

        <div className="flex h-[72px] shrink-0 items-center gap-4 border-b border-line bg-surface px-5">
          <div className="w-[150px] shrink-0">
            <div className="text-[12px] text-muted-ink">As of</div>
            <div className="font-heading text-[20px] font-semibold leading-tight num">{fmtDate(asOf)}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button aria-label="Previous document" onClick={() => step(-1)} className="rounded-md border border-line p-1.5 hover:bg-bg"><ChevronLeft size={16} /></button>
            <button aria-label={playing ? "Pause replay" : "Play replay"} onClick={() => setPlaying(!playing)} className="rounded-md border border-line p-1.5 hover:bg-bg">
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button aria-label="Next document" onClick={() => step(1)} className="rounded-md border border-line p-1.5 hover:bg-bg"><ChevronRight size={16} /></button>
          </div>
          <Track />
          <div className="flex shrink-0 items-center gap-3">
            <label className="sr-only" htmlFor="jump">Jump to</label>
            <select
              id="jump"
              value=""
              onChange={(e) => e.target.value && setAsOf(e.target.value)}
              className="h-8 w-[210px] rounded-md border border-line bg-surface px-2 text-[13px]"
            >
              <option value="">Jump to…</option>
              {JUMPS.map((j) => <option key={j.date} value={j.date}>{j.label}</option>)}
            </select>
            <button
              aria-pressed={groundTruth}
              onClick={() => setGroundTruth(!groundTruth)}
              className={cn("h-8 whitespace-nowrap rounded-md border px-2.5 text-[13px] font-medium", groundTruth ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-surface text-ink hover:bg-bg")}
            >
              Show what actually happened
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav aria-label="Main" className="flex w-[220px] shrink-0 flex-col gap-0.5 bg-navy-900 px-3 py-4">
            {NAV.map((n, i) => {
              const st = n.project ? statusOn(bundle, n.project, asOf)?.evidence_status : undefined
              const hasDocs = n.project ? replayDocs(bundle).some((d) => d.project === n.project && d.date <= asOf) : true
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  className={({ isActive }) =>
                    cn("relative flex h-9 items-center gap-2 rounded-md px-3 text-[14px] text-white/80 hover:bg-navy-800", isActive && "bg-navy-800 font-medium text-white")
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-teal-400" />}
                      <span className="flex-1">{n.label}</span>
                      {n.project && hasDocs && <StatusDot status={st} />}
                      {n.to === "/alerts" && <span className="num rounded-sm bg-white/15 px-1.5 text-[12px]" title={`${recent} ${recent === 1 ? "warning" : "warnings"} fired in the 14 days up to this date`} aria-label={`${recent} warnings in the last 14 days`}>{recent}</span>}
                      <span className="sr-only">Shortcut: press {i + 1}</span>
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
            <OutcomeBanner />
            <Outlet />
          </main>
        </div>
      </div>
      <div className="hidden h-dvh items-center justify-center bg-bg p-8 text-center text-ink max-lg:flex"><h1 className="font-heading text-[20px] font-semibold">Best viewed on a larger screen.</h1></div>
      <Toast />
      <SourceDrawer />
    </>
  )
}

function Track() {
  const bundle = useStore((s) => s.bundle)!
  const { asOf, setAsOf, groundTruth } = useStore()
  const ref = useRef<HTMLDivElement>(null)
  const { start, end } = bundle.meta.window
  const total = daysBetween(start, end)
  const pos = (d: string) => `${(Math.min(Math.max(daysBetween(start, d), 0), total) / total) * 100}%`

  const months = useMemo(() => {
    const out: { d: string; label: string }[] = []
    const s = new Date(start + "T00:00:00Z")
    for (let m = 0; m < 9; m++) {
      const d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + m, 1))
      const iso = d.toISOString().slice(0, 10)
      if (iso > end) break
      out.push({ d: iso < start ? start : iso, label: d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }) })
    }
    return out
  }, [start, end])

  const setFromX = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    setAsOf(addDays(start, Math.round(f * total)))
  }

  const alerts = bundle.alerts.filter((a) => a.severity !== "info" && a.fired_on <= asOf)
  const gt = bundle.ground_truth_events.filter((e) => groundTruth && e.date <= asOf)

  return (
    <div
      className="relative h-full min-w-[200px] flex-1 select-none"
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setFromX(e.clientX) }}
      onPointerMove={(e) => { if (e.buttons) setFromX(e.clientX) }}
    >
      <div ref={ref} role="slider" aria-label="As-of date" aria-valuemin={0} aria-valuemax={total} aria-valuenow={daysBetween(start, asOf)} aria-valuetext={fmtDate(asOf)} className="absolute inset-x-0 top-0 h-full cursor-ew-resize">
        <div className="absolute inset-x-0 top-[34px] h-1 rounded-full bg-line" />
        <div className="absolute left-0 top-[34px] h-1 rounded-full bg-blue-500/40" style={{ width: pos(asOf) }} />
        {months.map((m) => (
          <span key={m.d} className="absolute top-1 -translate-x-0 text-[11px] text-muted-ink" style={{ left: pos(m.d) }}>{m.label}</span>
        ))}
        {replayDocs(bundle).map((d) => (
          <span
            key={d.id}
            title={`${d.title} (${fmtDate(d.date)})`}
            className={cn("absolute top-[26px] h-5 w-[3px] -translate-x-1/2 rounded-sm", d.date > asOf && "opacity-35")}
            style={{ left: pos(d.date), background: PROJECT_COLOUR[d.project] }}
          />
        ))}
        {alerts.map((a) => (
          <span key={a.id} className={cn("absolute top-[50px] size-1.5 -translate-x-1/2 rounded-full", a.severity === "red" ? "bg-red" : "bg-amber")} style={{ left: pos(a.fired_on) }} />
        ))}
        {gt.map((e) => (
          <span key={e.id} title={`${e.label} (${fmtDate(e.date)})`} className="absolute top-[22px] h-7 w-1 -translate-x-1/2 bg-navy-900" style={{ left: pos(e.date) }} />
        ))}
        <span className="absolute top-[22px] h-7 w-1.5 -translate-x-1/2 rounded-full bg-blue-600 ring-2 ring-white" style={{ left: pos(asOf) }} />
      </div>
    </div>
  )
}

function Toast() {
  const toast = useStore((s) => s.toast)
  const showToast = useStore((s) => s.showToast)
  if (!toast) return null
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 flex max-w-[640px] -translate-x-1/2 items-center gap-4 rounded-lg bg-navy-900 px-4 py-2.5 text-[13px] text-white shadow-lg">
      <span>{toast.text}</span>
      {toast.undo && <button onClick={toast.undo} className="shrink-0 font-semibold text-[#8FD0F5] hover:underline">Undo</button>}
      <button onClick={() => showToast(null)} aria-label="Dismiss" className="shrink-0 text-white/70 hover:text-white">×</button>
    </div>
  )
}
