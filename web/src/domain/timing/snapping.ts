export function applySnapping(
  valueMs: number,
  edgeCandidatesMs: number[],
  gridStepMs = 100,
  thresholdMs = 60,
): number {
  const gridCandidate = Math.round(valueMs / gridStepMs) * gridStepMs
  const candidates = [gridCandidate, ...edgeCandidatesMs]

  let best = valueMs
  let bestDistance = Number.POSITIVE_INFINITY

  for (const c of candidates) {
    const d = Math.abs(c - valueMs)
    if (d <= thresholdMs && d < bestDistance) {
      best = c
      bestDistance = d
    }
  }

  return best
}
