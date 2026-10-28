import { type PingRow } from "@/lib/globalping";

export function summarizePing(rows: readonly PingRow[]) {
  const finished = rows.filter(
    (r) => r.result.status === "finished" && r.result.stats,
  );
  const responding = finished.filter((r) => (r.result.stats?.rcv ?? 0) > 0);
  const sorted = responding.toSorted(
    (a, b) => a.result.stats!.avg! - b.result.stats!.avg!,
  );
  let received = 0,
    total = 0,
    dropped = 0,
    weighted = 0;
  for (const row of finished) {
    const stats = row.result.stats!;
    total += stats.total;
    dropped += stats.drop;
    if (stats.rcv && stats.avg !== null) {
      received += stats.rcv;
      weighted += stats.rcv * stats.avg;
    }
  }
  return {
    average: received ? weighted / received : null,
    loss: total ? (100 * dropped) / total : null,
    responding: responding.length,
    unknown: rows.filter(
      (r) => r.result.status === "failed" || r.result.status === "offline",
    ).length,
    unanswered: finished.length - responding.length,
    fastest: sorted[0],
    slowest: sorted.at(-1),
  };
}

export const pingTime = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(2)} ms`;
