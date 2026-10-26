import { useEffect } from "react"
import { HashRouter, Route, Routes } from "react-router-dom"
import { useStore } from "@/store"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Shell } from "@/components/Shell"
import { Portfolio } from "@/views/Portfolio"
import { Project } from "@/views/Project"
import { Alerts } from "@/views/Alerts"
import { Board } from "@/views/Board"
import { Evaluation } from "@/views/Evaluation"
import { Sources } from "@/views/Sources"
import { AddReport } from "@/views/AddReport"

export default function App() {
  const { bundle, error, load } = useStore()
  useEffect(() => { void load() }, [load])

  if (error) return <div className="p-8 text-[14px] text-red">{error}</div>
  if (!bundle) return <div className="p-8 text-[14px] text-muted-ink">Loading…</div>

  return (
    <TooltipProvider delay={200}>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Portfolio />} />
            <Route path="project/:id" element={<Project />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="board" element={<Board />} />
            <Route path="evaluation" element={<Evaluation />} />
            <Route path="sources" element={<Sources />} />
            <Route path="add" element={<AddReport />} />
          </Route>
        </Routes>
      </HashRouter>
    </TooltipProvider>
  )
}
