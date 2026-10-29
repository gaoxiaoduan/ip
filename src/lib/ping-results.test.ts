import { describe, expect, it } from "vitest";

import type { PingMeasurement, PingRow } from "@/lib/globalping";
import { readPingResults } from "@/lib/ping-results";

const probe = {
  country: "CN", city: "Guangzhou", asn: 4134, network: "China Telecom", tags: [],
};
const response: PingRow = {
  probe,
  result: {
    status: "finished", resolvedAddress: "8.8.8.8",
    stats: { min: 18, avg: 20, max: 22, total: 5, rcv: 5, drop: 0, loss: 0 },
  },
};
const measurement = (results: PingRow[], status: PingMeasurement["status"] = "in-progress"): PingMeasurement => ({
  id: "measurement-1", probesCount: 4, status, results,
});

describe("多地 Ping 本轮结果", () => {
  it("等待中断保留成功证据，将等待与缺失身份计入无法判断且不计作丢包", () => {
    const input = measurement([
      response,
      { probe, result: { status: "in-progress", resolvedAddress: "1.1.1.1" } },
      { probe, result: { status: "failed", failureSource: "invalid-data" } },
    ]);
    const results = readPingResults(input, true);

    expect(results).toMatchObject({
      participants: 4, completed: 4, unidentified: 1,
      summary: { nodes: 4, responding: 1, unanswered: 0, unknown: 3, average: 20, loss: 0 },
    });
    expect(results.rows[1]).toMatchObject({
      status: "undetermined", label: "等待中断，无法判断", address: "1.1.1.1",
    });
    expect(input.results[1]?.result.status).toBe("in-progress");
  });
});
