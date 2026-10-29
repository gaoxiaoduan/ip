import type { PingMeasurement, PingRow } from "@/lib/globalping";

export type PingResultRow = {
  probe: PingRow["probe"];
  address: string | null;
  status: "pending" | "responding" | "unanswered" | "undetermined";
  label: string;
  packets?: NonNullable<PingRow["result"]["stats"]>;
};

export const pingTime = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(2)} ms`;

function readRow(row: PingRow, ended: boolean, interrupted: boolean): PingResultRow {
  const { probe, result } = row;
  const base = { probe, address: result.resolvedAddress ?? null };
  if (result.status === "finished" && result.stats) {
    return {
      ...base,
      status: result.stats.rcv ? "responding" : "unanswered",
      label: result.stats.rcv ? "已收到响应" : "目标未响应",
      packets: result.stats,
    };
  }
  if (result.status === "in-progress") {
    return {
      ...base,
      status: ended ? "undetermined" : "pending",
      label: ended ? (interrupted ? "等待中断，无法判断" : "测量结束，无法判断") : "等待结果",
    };
  }
  const failures: Record<string, string> = {
    "invalid-data": "节点数据无效，无法判断",
    resolver: "解析失败（服务商判断）",
    internal: "探针内部失败",
    target: "目标或网络失败（服务商判断）",
  };
  return {
    ...base,
    status: "undetermined",
    label: result.status === "offline" ? "探针离线" : failures[result.failureSource ?? ""] ?? "测量失败，无法判断",
  };
}

function summarize(rows: readonly PingResultRow[], unidentified: number) {
  const responding = rows.filter((row) => row.status === "responding");
  const sorted = responding.toSorted((a, b) => a.packets!.avg! - b.packets!.avg!);
  let received = 0, total = 0, dropped = 0, weighted = 0;
  for (const row of rows) {
    if (!row.packets) continue;
    const stats = row.packets;
    total += stats.total;
    dropped += stats.drop;
    if (stats.rcv && stats.avg !== null) {
      received += stats.rcv;
      weighted += stats.rcv * stats.avg;
    }
  }
  const nodes = rows.length + unidentified;
  const average = received ? weighted / received : null;
  const unanswered = rows.filter((row) => row.status === "unanswered").length;
  return {
    nodes,
    average,
    loss: total ? (100 * dropped) / total : null,
    responding: responding.length,
    unknown: rows.filter((row) => row.status === "undetermined").length + unidentified,
    unanswered,
    fastest: sorted[0],
    slowest: sorted.at(-1),
    description: !nodes ? "未测，无数据"
      : average !== null ? `${nodes} 个节点，平均 ${pingTime(average)}`
      : unanswered ? `${nodes} 个节点，目标未响应`
      : `${nodes} 个节点，无法判断`,
  };
}

export type PingSummary = ReturnType<typeof summarize>;

export const summarizePing = (rows: readonly PingResultRow[]): PingSummary => summarize(rows, 0);

export function readPingResults(measurement: PingMeasurement | null, interrupted = false) {
  const ended = interrupted || measurement?.status === "finished";
  const rows = (measurement?.results ?? []).map((row) => readRow(row, ended, interrupted));
  const participants = measurement?.probesCount ?? 0;
  const unidentified = ended ? Math.max(0, participants - rows.length) : 0;
  return {
    hasMeasurement: measurement !== null,
    rows,
    participants,
    unidentified,
    completed: rows.filter((row) => row.status !== "pending").length + unidentified,
    summary: summarize(rows, unidentified),
  };
}
