import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, History, Minus, MinusCircle, XCircle } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { EvidenceStatus, ReportedStatus, Severity, Verdict } from "@/types"
import { VERDICT_WORDS } from "@/lib/format"

export const PROJECT_COLOUR: Record<string, string> = {
  ashfield: "#1AA3E8",
  drumgarve: "#12B892",
  netherwood: "#7A8BA6",
}

type Tone = "red" | "amber" | "green" | "info" | "grey"
const TONE: Record<Tone, string> = {
  red: "bg-red/10 text-red",
  amber: "bg-amber/10 text-amber",
  green: "bg-green/10 text-green",
  info: "bg-info/10 text-[#0B6DA6]",
  grey: "bg-navy-600/10 text-navy-600",
}

export function Pill({ tone, icon, children, className }: { tone: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-sm px-2 text-[12px] font-medium", TONE[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

export function SeverityIcon({ severity, size = 16 }: { severity: Severity; size?: number }) {
  const common = { size, "aria-hidden": true }
  if (severity === "red") return <AlertOctagon {...common} className="shrink-0 text-red" />
  if (severity === "amber") return <AlertTriangle {...common} className="shrink-0 text-amber" />
  return <History {...common} className="shrink-0 text-info" />
}

const SEV_WORD: Record<Severity, string> = { red: "Red", amber: "Amber", info: "Info" }
export function SeverityPill({ severity }: { severity: Severity }) {
  const tone: Tone = severity === "red" ? "red" : severity === "amber" ? "amber" : "info"
  return (
    <Pill tone={tone} icon={<SeverityIcon severity={severity} size={13} />}>
      {SEV_WORD[severity]}
    </Pill>
  )
}

export function EvidencePill({ status }: { status: EvidenceStatus | undefined }) {
  if (status === "at_risk") return <Pill tone="red" icon={<AlertOctagon size={13} aria-hidden />}>At risk</Pill>
  if (status === "watch") return <Pill tone="amber" icon={<AlertTriangle size={13} aria-hidden />}>Watch</Pill>
  if (status === "on_track") return <Pill tone="green" icon={<CheckCircle2 size={13} aria-hidden />}>On track</Pill>
  return <Pill tone="grey" icon={<Minus size={13} aria-hidden />}>No data yet</Pill>
}

export function ReportedPill({ status }: { status: ReportedStatus | undefined }) {
  if (status === "in_delay") return <Pill tone="red" icon={<XCircle size={13} aria-hidden />}>In delay</Pill>
  if (status === "on_programme") return <Pill tone="green" icon={<CheckCircle2 size={13} aria-hidden />}>On programme</Pill>
  return <Pill tone="grey" icon={<MinusCircle size={13} aria-hidden />}>No status report</Pill>
}

export function StatusDot({ status }: { status: EvidenceStatus | undefined }) {
  const colour = status === "at_risk" ? "bg-red" : status === "watch" ? "bg-amber" : status === "on_track" ? "bg-green" : "bg-navy-600"
  const word = status === "at_risk" ? "At risk" : status === "watch" ? "Watch" : status === "on_track" ? "On track" : "No data yet"
  return <span className={cn("inline-block size-2 rounded-full", colour)} role="img" aria-label={word} title={word} />
}

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const label = VERDICT_WORDS[verdict]
  if (verdict === "contradicted") return <Pill tone="red" icon={<XCircle size={13} aria-hidden />}>{label}</Pill>
  if (verdict === "supported_with_caveat") return <Pill tone="amber" icon={<AlertTriangle size={13} aria-hidden />}>{label}</Pill>
  if (verdict === "supported") return <Pill tone="green" icon={<CheckCircle2 size={13} aria-hidden />}>{label}</Pill>
  return <Pill tone="grey" icon={<HelpCircle size={13} aria-hidden />}>{label}</Pill>
}

export function Panel({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("min-h-0 rounded-lg border border-line bg-surface", className)} {...rest}>
      {children}
    </div>
  )
}

export function PanelTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between px-4">
      <h2 className="text-[13px] font-semibold text-ink">{children}</h2>
      {right}
    </div>
  )
}

export function Pager({ page, pages, onPage, total, label }: { page: number; pages: number; onPage: (p: number) => void; total: number; label: string }) {
  if (pages <= 1) return <div className="px-4 py-2 text-[12px] text-muted-ink">{total} {label}</div>
  return (
    <div className="flex items-center justify-between px-4 py-2 text-[12px] text-muted-ink">
      <span>{total} {label}</span>
      <span className="flex items-center gap-2">
        <button aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)} className="rounded-sm p-1 hover:bg-bg disabled:opacity-40">
          <ChevronLeft size={16} />
        </button>
        <span className="num">Page {page + 1} of {pages}</span>
        <button aria-label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className="rounded-sm p-1 hover:bg-bg disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
      </span>
    </div>
  )
}

export const btn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:bg-bg"
export const btnPrimary =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 text-[13px] font-medium text-white hover:bg-[#0B6DA6]"
