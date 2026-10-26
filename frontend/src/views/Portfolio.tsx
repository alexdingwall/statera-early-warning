import { AlertOctagon, AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useStore } from "@/store"
import { ageText, daysBetween, fmtDate, ruleWords } from "@/lib/format"
import { docsUpTo, headlineFor, isOpenStatus, issueStatusOn, issuesSeen, latestChanges, latestSnapshot, lessonsAsOf, phaseOn, statusOn, topReasons } from "@/lib/selectors"
import { EvidencePill, Panel, PanelTitle, Pill, PROJECT_COLOUR, ReportedPill, SeverityIcon } from "@/components/ui-bits"
import { cn } from "@/lib/utils"
import type { Project } from "@/types"

export function Portfolio() {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const navigate = useNavigate()
  const changes = latestChanges(bundle, asOf, 14, 5)
  const lessons = lessonsAsOf(bundle, asOf)

  return (
    <div className="flex h-full flex-col gap-3">
      <h1 className="sr-only">Portfolio</h1>
      <div className="grid shrink-0 grid-cols-3 gap-3">
        {bundle.projects.map((p) => <ProjectCard key={p.id} p={p} />)}
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <Panel className="flex min-w-0 flex-[5] flex-col pb-2">
          <PanelTitle>Latest changes (last 14 days)</PanelTitle>
          {changes.length === 0 ? (
            <p className="px-4 text-[13px] text-muted-ink">Nothing has changed in the 14 days before {fmtDate(asOf)}.</p>
          ) : (
            <ul className="min-h-0 flex-1 px-2">
              {changes.map((c, i) => (
                <li key={i}>
                  <button onClick={() => navigate(`/project/${c.project}?issue=${c.issueId}`)} className="flex h-[24px] w-full items-center gap-3 rounded-sm px-2 text-left text-[13px] hover:bg-bg">
                    <span className="num w-[84px] shrink-0 text-muted-ink">{fmtDate(c.date)}</span>
                    <span className="size-2 shrink-0 rounded-full" style={{ background: PROJECT_COLOUR[c.project] }} aria-hidden />
                    <span className="w-[78px] shrink-0 capitalize text-muted-ink">{c.project}</span>
                    {c.severity ? <SeverityIcon severity={c.severity} size={14} /> : <span className="w-[14px]" />}
                    <span className="truncate">{c.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="flex min-w-0 flex-[6] flex-col pb-2">
          <PanelTitle>Lessons from Netherwood, still open</PanelTitle>
          {lessons.length === 0 ? (
            <p className="px-4 text-[13px] text-muted-ink">The Netherwood lessons workshop has not happened yet as of {fmtDate(asOf)}.</p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-1.5 px-4">
              {lessons.map(({ lesson, items }) => (
                <li key={lesson.id} className="text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{lesson.action}</span>
                    <Pill tone={lesson.status === "Not done" ? "red" : "amber"}>{lesson.status}</Pill>
                  </div>
                  <p className="truncate pl-0.5 text-[12px] text-muted-ink">
                    {items.length === 0 ? "Not recurring anywhere yet." : `Recurring now: ${[...new Set(items.map((x) => x.issue ? `${cap(x.project)}, ${x.issue.title}` : `${cap(x.project)}, ${x.why.toLowerCase()}`))].slice(0, 2).join("; ")}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-ink">{label}</div>
      <div className="num truncate text-[13px] font-medium">{children}</div>
    </div>
  )
}

const TONE_ICON = {
  red: <AlertOctagon size={18} className="mt-0.5 shrink-0 text-red" aria-hidden />,
  amber: <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" aria-hidden />,
  green: <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green" aria-hidden />,
  grey: <MinusCircle size={18} className="mt-0.5 shrink-0 text-navy-600" aria-hidden />,
}

function ProjectCard({ p }: { p: Project }) {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const docs = docsUpTo(bundle, asOf, p.id)
  const st = statusOn(bundle, p.id, asOf)
  const snap = latestSnapshot(bundle, p.id, asOf)
  const head = headlineFor(bundle, p.id, asOf)
  const reasons = topReasons(bundle, asOf, p.id).slice(0, 2)
  const issues = issuesSeen(bundle, asOf, p.id)
  const open = issues.filter((i) => isOpenStatus(issueStatusOn(i, asOf)))
  const oldest = open.length ? open.reduce((a, b) => (a.first_seen <= b.first_seen ? a : b)) : null
  const lessonCount = lessonsAsOf(bundle, asOf, p.id).filter((l) => l.items.length).length

  return (
    <Panel className={cn("flex flex-col", st?.divergent && "border-red")}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <h2 className="font-heading text-[16px] font-semibold">
            <Link to={`/project/${p.id}`} className="hover:underline">{p.name}</Link>
          </h2>
          <p className="truncate text-[12px] text-muted-ink">{[phaseOn(p, asOf), p.capacity, p.pm && `PM ${p.pm}`].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: PROJECT_COLOUR[p.id] }} aria-hidden />
      </div>

      {docs.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted-ink">No documents for this project as of {fmtDate(asOf)}.</p>
      ) : (
        <>
          <div className="flex items-start gap-2 px-4 pt-2.5">
            {TONE_ICON[head.tone]}
            <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{head.text}</p>
          </div>
          <div className="flex gap-5 px-4 pt-2">
            <div><div className="mb-0.5 text-[11px] text-muted-ink">Reported</div><ReportedPill status={st?.reported_status} /></div>
            <div><div className="mb-0.5 text-[11px] text-muted-ink">Evidence</div><EvidencePill status={st?.evidence_status} /></div>
          </div>
          {head.detail && <p className={cn("px-4 pt-1.5 text-[12px] font-medium", st?.divergent ? "text-red" : "text-muted-ink")}>{head.detail}</p>}

          <ul className="mt-2 space-y-1 border-t border-line px-4 pt-2">
            {reasons.length === 0 && <li className="text-[12px] text-muted-ink">No active red or amber alerts.</li>}
            {reasons.map(({ alert, issue }) => (
              <li key={alert.id}>
                <Link to={`/project/${p.id}?issue=${issue.id}`} className="flex items-start gap-2 text-[12px] hover:underline">
                  <span className="mt-0.5"><SeverityIcon severity={alert.severity} size={13} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{issue.title}</span>
                    <span className="block truncate text-muted-ink">{ruleWords(alert.rule, alert.severity)} · {fmtDate(alert.fired_on)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-auto grid grid-cols-3 gap-x-2 border-t border-line px-4 pt-2">
            <Fact label="Baseline">{fmtDate(p.baseline_energisation)}</Fact>
            <Fact label="Forecast">{snap?.forecast ? fmtDate(snap.forecast) : "—"}</Fact>
            <Fact label="Float">{snap?.float_days != null ? `${snap.float_days} days` : "—"}</Fact>
          </div>
          <p className="truncate px-4 pb-2 pt-1 text-[12px] text-muted-ink">
            {p.commercial_date ? `Commercial: ${p.commercial_label.toLowerCase()} ${fmtDate(p.commercial_date)} (${daysBetween(asOf, p.commercial_date)} days)` : p.commercial_label}
          </p>
          <div className="flex items-center justify-between border-t border-line px-4 py-1.5 text-[12px] text-muted-ink">
            <span>{open.length} open{oldest ? ` · oldest ${ageText(oldest.first_seen, asOf).replace("open ", "")}` : ""}</span>
            <Link to={`/project/${p.id}?view=lessons`} className="text-[#0B6DA6] hover:underline">
              {lessonCount ? `${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"} recurring` : "Lessons"}
            </Link>
          </div>
        </>
      )}
    </Panel>
  )
}
