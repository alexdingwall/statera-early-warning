export function readFb(id: string): string | null {
  try { return localStorage.getItem(`ew-feedback-${id}`) } catch { return null }
}
export function writeFb(id: string, v: string) {
  try { localStorage.setItem(`ew-feedback-${id}`, v) } catch { /* storage unavailable */ }
}
