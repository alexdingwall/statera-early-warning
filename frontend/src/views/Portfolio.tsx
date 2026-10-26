import { Link, useNavigate } from "react-router-dom"
import { useStore } from "@/store"
import { ageText, daysBetween, fmtDate, ruleWords } from "@/lib/format"
import { activeAlertsOn, bySeverityThenNewest, docsUpTo, isOpenStatus, issueStatusOn, issuesSeen, latestChanges, latestSnapshot, phaseOn, statusOn } from "@/lib/selectors"
import { EvidencePill, Panel, PanelTitle, PROJECT_COLOUR, ReportedPill, SeverityIcon } from "@/components/ui-bits"
import { cn } from "@/lib/utils"
import type { Project } from "@/types"

export function Portfolio() {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const navigate = useNavigate()
  const changes = latestChanges(bundle, asOf)

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="sr-only">Portfolio</h1>
      <div className="grid shrink-0 grid-cols-3 gap-4">
        {bundle.projects.map((p) => <ProjectCard key={p.id} p={p} />)}
      </div>
      <Panel className="flex shrink-0 flex-col pb-2">
        <PanelTitle>Latest changes (last 14 days)</PanelTitle>
        {changes.length === 0 ? (
          <p className="px-4 text-[13px] text-muted-ink">Nothing has changed in the 14 days before {fmtDate(asOf)}.</p>
        ) : (
          <ul className="min-h-0 flex-1 px-2">
            {changes.map((c, i) => (
              <li key={i}>
                <button
                  onClick={() => navigate(`/project/${c.project}?issue=${c.issueId}`)}
                  className="flex h-[24px] w-full items-center gap-3 rounded-sm px-2 text-left text-[13px] hover:bg-bg"
                >
                  <span className="num w-[84px] shrink-0 text-muted-ink">{fmtDate(c.date)}</span>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: PROJECT_COLOUR[c.project] }} aria-hidden />
                  <span className="w-[84px] shrink-0 capitalize text-muted-ink">{c.project}</span>
                  {c.severity ? <SeverityIcon severity={c.severity} size={14} /> : <span className="w-[14px]" />}
                  <span className="truncate">{c.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function KeyDate({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <div title={title} className="flex items-baseline justify-between gap-2 text-[13px]">
      <span className="text-muted-ink">{label}</span>
      <span className="num text-right font-medium">{children}</span>
    </div>
  )
}

function ProjectCard({ p }: { p: Project }) {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const docs = docsUpTo(bundle, asOf, p.id)
  const st = statusOn(bundle, p.id, asOf)
  const snap = latestSnapshot(bundle, p.id, asOf)
  const issues = issuesSeen(bundle, asOf, p.id)
  const open = issues.filter((i) => isOpenStatus(issueStatusOn(i, asOf)))
  const oldest = open.length ? Math.max(...open.map((i) => daysBetween(i.first_seen, asOf))) : 0
  const alerts = activeAlertsOn(bundle, asOf, p.id).sort(bySeverityThenNewest)
    .filter((a, i, all) => all.findIndex((x) => x.issue_id === a.issue_id) === i)   // one line per issue
    .slice(0, 2)
  const issueTitle = new Map(bundle.issues.map((i) => [i.id, i.title]))

  return (
    <Panel className={cn("flex flex-col", st?.divergent && "border-red")}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <h2 className="font-heading text-[16px] font-semibold">
            <Link to={`/project/${p.id}`} className="hover:underline">{p.name}</Link>
          </h2>
          <p className="truncate text-[12px] text-muted-ink">{[phaseOn(p, asOf), p.capacity, p.pm && `PM ${p.pm}`].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="mt-1 size-2.5 rounded-full" style={{ background: PROJECT_COLOUR[p.id] }} aria-hidden />
      </div>

      {docs.length === 0 ? (
        <p className="px-4 pt-4 text-[13px] text-muted-ink">No documents for this project as of {fmtDate(asOf)}.</p>
      ) : (
        <>
          <div className="flex gap-4 px-4 pt-3">
            <div><div className="mb-1 text-[12px] text-muted-ink">Reported</div><ReportedPill status={st?.reported_status} /></div>
            <div><div className="mb-1 text-[12px] text-muted-ink">Evidence</div><EvidencePill status={st?.evidence_status} /></div>
          </div>
          {st?.divergent && <p className="px-4 pt-2 text-[13px] font-medium text-red">Reported status and evidence disagree.</p>}

          <div className="space-y-1 px-4 pt-3">
            <KeyDate label="Baseline energisation">{fmtDate(p.baseline_energisation)}</KeyDate>
            <KeyDate label="Latest forecast">{snap?.forecast ? fmtDate(snap.forecast) : "—"}</KeyDate>
            {p.commercial_date ? (
              <KeyDate label="Commercial date" title={p.commercial_label}>
                {fmtDate(p.commercial_date)} ({daysBetween(asOf, p.commercial_date) >= 0 ? `in ${daysBetween(asOf, p.commercial_date)} days` : `${-daysBetween(asOf, p.commercial_date)} days ago`})
              </KeyDate>
            ) : (
              <p className="pt-1 text-[12px] text-muted-ink">{p.commercial_label}</p>
            )}
          </div>

          <div className="mt-2 min-h-0 flex-1 overflow-hidden border-t border-line px-4 pt-2">
            {alerts.length === 0 ? (
              <p className="text-[13px] text-muted-ink">No active alerts.</p>
            ) : (
              <ul className="space-y-1.5">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Link to={`/project/${p.id}?issue=${a.issue_id}`} className="flex items-start gap-2 text-[13px] hover:underline">
                      <SeverityIcon severity={a.severity} size={15} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{issueTitle.get(a.issue_id)}</span>
                        <span className="block truncate text-[12px] text-muted-ink">{ruleWords(a.rule, a.severity)} · {fmtDate(a.fired_on)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[12px] text-muted-ink">
            <span>Open issues: {open.length}{open.length ? ` · oldest ${ageText(new Date(new Date(asOf).getTime() - oldest * 864e5).toISOString().slice(0, 10), asOf)}` : ""}</span>
            <Link to={`/project/${p.id}`} className="text-[#0B6DA6] hover:underline">View all</Link>
          </div>
        </>
      )}
    </Panel>
  )
}
