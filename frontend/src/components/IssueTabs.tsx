import { ChevronRight } from "lucide-react"
import { useStore } from "@/store"
import { triggersFor } from "@/lib/selectors"
import { IssueStory } from "@/components/IssueStory"
import type { Issue } from "@/types"

/** The record behind a decision, in date order, ending at the date being viewed. */
export function IssueTabs({ issue }: { issue: Issue }) {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const alerts = bundle.alerts.filter((a) => a.issue_id === issue.id && a.fired_on <= asOf).sort((a, b) => a.fired_on.localeCompare(b.fired_on))
  const n = issue.mentions.filter((m) => m.date <= asOf).length
  return (
    <details className="group shrink-0 border-t border-line pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold marker:hidden">
        <ChevronRight size={14} className="transition-transform group-open:rotate-90" aria-hidden />
        History <span className="font-normal text-muted-ink">· {n} {n === 1 ? "report" : "reports"}</span>
      </summary>
      <div className="mt-1.5 text-[13px]">
        <IssueStory issue={issue} asOf={asOf} alerts={alerts} triggers={triggersFor(bundle, issue.id, asOf)} docs={bundle.documents} />
      </div>
    </details>
  )
}
