export type ScoreSource = 'pass' | 'draft' | 'needle' | 'drift' | 'speed';
export interface ScoreAward { id: string; source: ScoreSource; basePoints: number; multiplier: number; points: number }
export class ScoreLedger {
  private seen = new Set<string>();
  private lastSpeedSequence = -1;
  readonly totals: Record<ScoreSource, number> = { pass: 0, draft: 0, needle: 0, drift: 0, speed: 0 };
  readonly recent: ScoreAward[] = [];
  total = 0;
  award(id: string, source: ScoreSource, basePoints: number, multiplier = 1): number {
    if (this.seen.has(id) || !Number.isFinite(basePoints * multiplier)) return 0;
    const sequence = source === 'speed' && /^speed:\d+$/.test(id) ? Number(id.slice(6)) : null;
    if (sequence !== null) {
      if (sequence <= this.lastSpeedSequence) return 0;
      this.lastSpeedSequence = sequence;
    } else this.seen.add(id);
    const points = Math.max(0, Math.round(basePoints * multiplier));
    this.total += points; this.totals[source] += points;
    this.recent.push({ id, source, basePoints, multiplier, points });
    if (this.recent.length > 100) this.recent.shift();
    return points;
  }
  reset(): void {
    this.seen.clear(); this.recent.length = 0; this.total = 0; this.lastSpeedSequence = -1;
    for (const key of Object.keys(this.totals) as ScoreSource[]) this.totals[key] = 0;
  }
}
