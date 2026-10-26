import { Link } from "react-router-dom"
import { useStore } from "@/store"
import { fmtDate } from "@/lib/format"
import { docById, issuesSeen, lessonsAsOf, matchesFor } from "@/lib/selectors"
import { Panel, PanelTitle, Pill } from "@/components/ui-bits"

export function LessonsView({ project }: { project: string }) {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const openDrawer = useStore((s) => s.openDrawer)
  const hits = lessonsAsOf(bundle, asOf, project)
  const issues = issuesSeen(bundle, asOf, project)
  const seen = issues.flatMap((i) => matchesFor(bundle, i, asOf).map((m) => ({ issue: i, m })))
  const byId = new Map(bundle.issues.map((i) => [i.id, i]))

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <Panel className="flex min-w-0 flex-[11] flex-col">
        <PanelTitle>Lessons agreed on Netherwood and where they apply here</PanelTitle>
        {hits.length === 0 ? (
          <p className="px-4 text-[13px] text-muted-ink">No lessons have been recorded as of {fmtDate(asOf)}. The Netherwood workshop is on 5 Feb 2025.</p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-3 overflow-hidden px-4 pb-3">
            {hits.map(({ lesson, items }) => (
              <li key={lesson.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[13px] font-semibold">{lesson.title}</h3>
                  <Pill tone={lesson.status === "Not done" ? "red" : "amber"}>{lesson.status}</Pill>
                </div>
                <p className="text-[12px] text-muted-ink">{lesson.summary}</p>
                <p className="mt-0.5 text-[12px]">
                  <span className="text-muted-ink">Agreed action: </span>{lesson.action}
                  <span className="text-muted-ink"> · owner {lesson.owner} · </span>
                  <button className="text-[#0B6DA6] hover:underline" onClick={() => openDrawer({ docId: lesson.source_doc })}>{docById(bundle, lesson.source_doc).title}</button>
                </p>
                <p className="mt-1 text-[12px] font-medium">
                  {items.length === 0 ? <span className="font-normal text-muted-ink">Nothing on this project matches yet.</span> : "Happening here now:"}
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {items.slice(0, 3).map((x, i) => (
                    <li key={i} className="text-[12px]">
                      {x.issue ? (
                        <Link to={`/project/${project}?issue=${x.issue.id}`} className="hover:underline">{x.issue.title}</Link>
                      ) : <span>{x.why}</span>}
                      {x.issue && <span className="text-muted-ink"> · {x.why}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="flex min-w-0 flex-[9] flex-col">
        <PanelTitle>Seen before on other projects</PanelTitle>
        {seen.length === 0 ? (
          <p className="px-4 text-[13px] text-muted-ink">No earlier incident on another project matches an issue here as of {fmtDate(asOf)}.</p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-2.5 overflow-hidden px-4 pb-3">
            {seen.slice(0, 4).map(({ issue, m }) => {
              const prior = byId.get(m.prior_issue_id)!
              return (
                <li key={m.id} className="text-[12px]">
                  <Link to={`/project/${project}?issue=${issue.id}`} className="text-[13px] font-semibold hover:underline">{issue.title}</Link>
                  <p>
                    <span className="text-muted-ink">Like </span>{prior.title}
                    <span className="text-muted-ink"> at <span className="capitalize">{prior.project}</span> ({fmtDate(prior.first_seen)}) </span>
                    <Pill tone={m.confidence === "high" ? "info" : "grey"} className="h-5">{m.confidence === "high" ? "High" : "Medium"}</Pill>
                  </p>
                  <p className="line-clamp-2 text-muted-ink">{m.explanation}</p>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
