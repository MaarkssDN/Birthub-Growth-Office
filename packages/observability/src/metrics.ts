/** Métricas mínimas em memória — séries temporais simples por chave. */
const counters = new Map<string, number>();
const timings = new Map<string, number[]>();

export function incr(key: string, by = 1): void {
  counters.set(key, (counters.get(key) ?? 0) + by);
}

export function gauge(key: string, value: number): void {
  counters.set(key, value);
}

export function observeTiming(key: string, ms: number): void {
  const arr = timings.get(key) ?? [];
  arr.push(ms);
  if (arr.length > 1000) arr.shift();
  timings.set(key, arr);
}

export function snapshot(): Record<string, number | { count: number; avgMs: number | null }> {
  const out: Record<string, number | { count: number; avgMs: number | null }> = {};
  for (const [k, v] of counters) out[`counter.${k}`] = v;
  for (const [k, arr] of timings) {
    out[`timing.${k}`] = {
      count: arr.length,
      avgMs: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null,
    };
  }
  return out;
}
