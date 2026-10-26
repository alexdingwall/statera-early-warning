import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { API, useStore } from "@/store"
import { DOC_TYPE_LABEL, fmtDate } from "@/lib/format"
import { changesSince } from "@/lib/selectors"
import { btn, btnPrimary, Panel } from "@/components/ui-bits"
import type { Bundle } from "@/types"

const TYPES = ["weekly_report", "site_visit", "planning_status", "procurement_issue", "handover_status", "commissioning_summary", "board_update"]
const SAMPLE = { file: "ashfield_weekly_wk28_SYNTHETIC.txt", project: "ashfield", type: "weekly_report", date: "2025-07-11", title: "Ashfield weekly report, week 28 (synthetic sample)", author: "J. Patel" }
const input = "h-8 w-full rounded-md border border-line bg-surface px-2 text-[13px]"

/** Best guesses from the file name and text; the person confirms them before anything is added. */
function guess(name: string, text: string, projects: string[]) {
  const hay = `${name}\n${text.slice(0, 600)}`.toLowerCase()
  const project = projects.find((p) => hay.includes(p)) ?? ""
  const type = /board/.test(hay) ? "board_update" : /visit|walkover/.test(hay) ? "site_visit" : /planning|condition/.test(hay) ? "planning_status" : "weekly_report"
  let date = ""
  const iso = hay.match(/(\d{4})-(\d{2})-(\d{2})/)
  const uk = hay.match(/(?:ending|dated?|compiled)\s+(\d{2})\/(\d{2})\/(\d{4})/)
  if (uk) date = `${uk[3]}-${uk[2]}-${uk[1]}`
  else if (iso) date = iso[0]
  const title = text.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("[")) ?? name
  return { project, type, date, title: title.slice(0, 90) }
}

export function AddReport() {
  const bundle = useStore((s) => s.bundle)!
  const setBundle = useStore((s) => s.setBundle)
  const setAsOf = useStore((s) => s.setAsOf)
  const navigate = useNavigate()
  const [online, setOnline] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ title: string; date: string; items: ReturnType<typeof changesSince>["items"]; from: string | null } | null>(null)
  const [f, setF] = useState({ file: "", text: "", project: "", type: "weekly_report", date: "", title: "", author: "" })
  const added = bundle.documents.filter((d) => d.uploaded)
  const ok = !!(f.text.trim() && f.project && f.date && f.title.trim() && f.file)

  useEffect(() => {
    fetch(`${API}/api/health`, { signal: AbortSignal.timeout(1500) }).then((r) => setOnline(r.ok)).catch(() => setOnline(false))
  }, [])

  const pick = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setF({ ...f, file: file.name, text, ...guess(file.name, text, bundle.projects.map((p) => p.id)), author: f.author })
    setError(null); setDone(null)
  }
  const useSample = async () => {
    const text = await fetch(`${import.meta.env.BASE_URL}samples/${SAMPLE.file}`).then((r) => r.text())
    setF({ file: SAMPLE.file, text, project: SAMPLE.project, type: SAMPLE.type, date: SAMPLE.date, title: SAMPLE.title, author: SAMPLE.author })
    setError(null); setDone(null)
  }
  const call = async (method: "POST" | "DELETE") => {
    setBusy(true); setError(null); setDone(null)
    try {
      const res = await fetch(`${API}/api/documents`, {
        method, headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify({ filename: f.file, text: f.text, project: f.project, doc_type: f.type, date: f.date, title: f.title, author: f.author || null }) : undefined,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail ?? `HTTP ${res.status}`)
      const next = body.bundle as Bundle
      setBundle(next)
      if (method === "POST") {
        const c = changesSince(next, f.date)
        setDone({ title: f.title, date: f.date, items: c.items, from: c.from })
        setAsOf(f.date)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <Panel className="h-full overflow-y-auto p-5">
      <h1 className="font-heading text-[18px] font-semibold">Add a report</h1>
      <p className="mt-0.5 max-w-[640px] text-[13px] text-muted-ink">
        The local model reads the report, matches its issues to the ones already tracked, and everything is recalculated.
        The report is dated by you, so it takes its place in the replay.
      </p>

      {online === false && (
        <p className="mt-3 max-w-[640px] rounded-md border border-line bg-bg px-3 py-2 text-[13px]">
          Adding reports works when the backend is running on this computer: from <code>backend/</code> run <code>uv run uvicorn app.api:app --port 8000</code>, with Ollama running. This copy of the site is read-only.
        </p>
      )}

      <div className="mt-4 grid max-w-[640px] grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
        <label className="col-span-2 block">
          <span className="mb-1 block text-[12px] font-medium text-muted-ink">Report file (.txt or .md)</span>
          <span className="flex items-center gap-2">
            <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(e) => void pick(e.target.files?.[0])} className="text-[13px]" />
            <button type="button" className={btn} onClick={() => void useSample()}>Use the sample report</button>
          </span>
          <span className="mt-1 block text-[12px] text-muted-ink">The sample is invented for this demo and says so on its first line. It follows the real week 27 report.</span>
        </label>
        <label className="block"><span className="mb-1 block text-[12px] font-medium text-muted-ink">Project</span>
          <select className={input} value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}>
            <option value="">Choose…</option>
            {bundle.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-[12px] font-medium text-muted-ink">Type of report</span>
          <select className={input} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-[12px] font-medium text-muted-ink">Date of the report</span>
          <input type="date" className={input} value={f.date} min={bundle.meta.window.start} max={bundle.meta.window.end} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </label>
        <label className="block"><span className="mb-1 block text-[12px] font-medium text-muted-ink">Author (optional)</span>
          <input className={input} value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
        </label>
        <label className="col-span-2 block"><span className="mb-1 block text-[12px] font-medium text-muted-ink">Title</span>
          <input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button className={btnPrimary} disabled={!ok || !online || busy} onClick={() => void call("POST")}>{busy ? "Reading the report…" : "Add and read report"}</button>
        {busy && <span className="text-[13px] text-muted-ink">The local model is reading it. This takes up to a minute or two.</span>}
      </div>
      {error && <p role="alert" className="mt-3 max-w-[640px] text-[13px] font-medium text-red">{error}</p>}

      {done && (
        <div className="mt-5 max-w-[640px] rounded-md border border-blue-500/40 bg-blue-500/5 p-3 text-[13px]">
          <p className="font-semibold">Added “{done.title}”, dated {fmtDate(done.date)}.</p>
          {done.items.length ? (
            <>
              <p className="mt-1 text-muted-ink">What changed {done.from ? `since ${fmtDate(done.from)}` : ""}:</p>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
                {done.items.slice(0, 6).map((n) => <li key={n.issueId + n.text}><span className="capitalize">{n.project}</span> · {n.text}</li>)}
              </ul>
            </>
          ) : <p className="mt-1 text-muted-ink">Nothing new was raised.</p>}
          <p className="mt-1 text-[12px] text-muted-ink">Some warnings come from the calendar, not the report: a deadline set earlier has got closer.</p>
          <button className={`${btnPrimary} mt-2`} onClick={() => navigate("/")}>See the Portfolio on {fmtDate(done.date)}</button>
        </div>
      )}

      {added.length > 0 && (
        <div className="mt-6 max-w-[640px] border-t border-line pt-3 text-[13px]">
          <h2 className="font-semibold">Reports added in this session</h2>
          <ul className="mt-1 space-y-0.5">{added.map((d) => <li key={d.id}><span className="num text-muted-ink">{fmtDate(d.date)}</span> · {d.title}</li>)}</ul>
          <button className={`${btn} mt-2`} disabled={busy || !online} onClick={() => void call("DELETE")}>Remove added reports and return to the sample</button>
        </div>
      )}
    </Panel>
  )
}
