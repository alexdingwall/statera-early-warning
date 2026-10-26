import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@/store"
import { fmtDate, ruleWords } from "@/lib/format"
import { alertsFired } from "@/lib/selectors"
import { Pager, Panel, PROJECT_COLOUR, SeverityPill } from "@/components/ui-bits"

const PAGE = 8
const sel = "h-8 rounded-md border border-line bg-surface px-2 text-[13px]"

export function Alerts() {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const navigate = useNavigate()
  const [project, setProject] = useState("")
  const [severity, setSeverity] = useState("")
  const [rule, setRule] = useState("")
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [project, severity, rule, asOf])

  const all = alertsFired(bundle, asOf)
    .filter((a) => (!project || a.project === project) && (!severity || a.severity === severity) && (!rule || a.rule === rule))
    .sort((a, b) => b.fired_on.localeCompare(a.fired_on) || a.id.localeCompare(b.id))
  const pages = Math.max(1, Math.ceil(all.length / PAGE))
  const rows = all.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <Panel className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 px-4 py-2.5">
        <h1 className="mr-auto font-heading text-[16px] font-semibold">Alerts fired up to {fmtDate(asOf)}</h1>
        <label className="sr-only" htmlFor="f-project">Project</label>
        <select id="f-project" className={sel} value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">All projects</option>
          {bundle.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-sev">Severity</label>
        <select id="f-sev" className={sel} value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          <option value="red">Red</option><option value="amber">Amber</option><option value="info">Info</option>
        </select>
        <label className="sr-only" htmlFor="f-rule">Rule</label>
        <select id="f-rule" className={sel} value={rule} onChange={(e) => setRule(e.target.value)}>
          <option value="">All rules</option>
          {["PERSISTENCE", "TRIGGER", "IMPACT", "PRIOR_INCIDENT"].map((r) => <option key={r} value={r}>{ruleWords(r, "amber")}</option>)}
        </select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        <table className="w-full table-fixed text-[13px]">
          <thead>
            <tr className="h-8 border-b border-line text-left text-[12px] font-medium text-muted-ink">
              <th className="w-[96px] px-2 font-medium">Fired</th>
              <th className="w-[96px] px-2 font-medium">Project</th>
              <th className="w-[26%] px-2 font-medium">Issue</th>
              <th className="w-[220px] px-2 font-medium">Rule</th>
              <th className="w-[84px] px-2 font-medium">Severity</th>
              <th className="px-2 font-medium">Explanation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} onClick={() => navigate(`/project/${a.project}?issue=${a.issue_id}`)} className="h-[38px] cursor-pointer border-b border-line/60 hover:bg-bg">
                <td className="num px-2">{fmtDate(a.fired_on)}</td>
                <td className="px-2"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: PROJECT_COLOUR[a.project] }} />{a.project.charAt(0).toUpperCase() + a.project.slice(1)}</td>
                <td className="px-2 py-1">{a.title}</td>
                <td className="px-2 py-1">{ruleWords(a.rule, a.severity)}</td>
                <td className="px-2"><SeverityPill severity={a.severity} /></td>
                <td className="px-2 py-1 text-[12px] text-muted-ink">{a.explanation}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-muted-ink">No alerts match these filters as of {fmtDate(asOf)}.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} total={all.length} label={all.length === 1 ? "alert" : "alerts"} />
    </Panel>
  )
}
