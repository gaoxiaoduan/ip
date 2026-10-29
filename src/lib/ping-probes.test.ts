import { describe, expect, it } from "vitest";

import type { PingProbe } from "@/lib/globalping";
import { planPingCoverage } from "@/lib/ping-probes";

const probe = (city: string, asn: number, country = "CN"): PingProbe => ({
  location: { city, asn, country, network: "test" }, tags: [],
});

describe("远端探针选取与覆盖依据", () => {
  it("选取和覆盖说明使用同城去重、三网分类及补充地区配额", () => {
    const coverage = planPingCoverage([
      probe("Guangzhou", 4134), probe("Guangzhou", 4812),
      probe("Wuhan", 4837), probe("Shanghai", 9808),
      probe("Cloud", 45102), probe("Hong Kong", 13335, "HK"),
      probe("Tokyo", 13335, "JP"),
    ], { carriers: ["电信", "联通", "移动"], mainland: true, regional: true, overseas: true });

    expect(coverage.locations).toHaveLength(5);
    expect(coverage.carriers).toEqual({
      电信: { available: 1, selected: 1 },
      联通: { available: 1, selected: 1 },
      移动: { available: 1, selected: 1 },
    });
    expect(coverage.shortfalls).toEqual([{ label: "海外", selected: 1, maximum: 2 }]);
    expect(coverage.locations.map(({ city }) => city)).toEqual([
      "Guangzhou", "Wuhan", "Shanghai", "Hong Kong", "Tokyo",
    ]);
  });
});
