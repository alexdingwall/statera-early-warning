import { useStore } from "@/store"
import { triggersFor } from "@/lib/selectors"
import { IssueStory } from "@/components/IssueStory"
import type { Issue } from "@/types"

/** The record behind a decision, in date order, ending at the date being viewed. */
export function IssueTabs({ issue }: { issue: Issue }) {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const alerts = bundle.alerts.filter((a) => a.issue_id === issue.id && a.fired_on <= asOf).sort((a, b) => a.fired_on.localeCompare(b.fired_on))
  return (
    <section className="shrink-0 border-t border-line pt-2">
      <h3 className="mb-1.5 text-[12px] font-semibold text-muted-ink">History</h3>
      <div className="text-[13px]">
        <IssueStory issue={issue} asOf={asOf} alerts={alerts} triggers={triggersFor(bundle, issue.id, asOf)} docs={bundle.documents} />
      </div>
    </section>
  )
}
