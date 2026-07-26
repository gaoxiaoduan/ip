import { describe, expect, it, vi } from "vitest";

import {
  compareOutletObservations,
  runDetectionPath,
  type DetectionEndpoint,
  type DetectionPath,
} from "@/lib/detection";
import { DETECTION_PATHS } from "@/lib/endpoints";

const parseObservation = (payload: unknown) => {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "ip" in payload &&
    "country" in payload &&
    typeof payload.ip === "string" &&
    typeof payload.country === "string"
  ) {
    return {
      ip: payload.ip,
      country: payload.country,
    };
  }

  return null;
};

const endpoint = (
  id: string,
  url: string,
  redundancy: DetectionEndpoint["redundancy"],
): DetectionEndpoint => ({
  id,
  label: id,
  url,
  source: {
    label: id,
    url,
  },
  redundancy,
  responseType: "json",
  parse: parseObservation,
});

describe("runDetectionPath", () => {
  it("主检测端点返回无效结果时使用备用检测端点", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: "missing fields" }))
      .mockResolvedValueOnce(
        Response.json({ ip: "203.0.113.42", country: "日本" }),
      );
    const path: DetectionPath = {
      id: "ordinary-overseas",
      label: "普通海外网站路径",
      description: "test",
      endpoints: [
        endpoint("primary", "https://primary.example/observe", "primary"),
        endpoint(
          "fallback",
          "https://fallback.example/observe",
          "independent-fallback",
        ),
      ],
    };

    const result = await runDetectionPath(path, {
      fetcher,
      now: () => new Date("2026-07-26T10:00:00.000Z"),
      timeoutMs: 100,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      pathId: "ordinary-overseas",
      status: "success",
      observation: {
        ip: "203.0.113.42",
        country: "日本",
      },
      endpoint: {
        id: "fallback",
        redundancy: "independent-fallback",
      },
      attempts: [
        { endpointId: "primary", outcome: "invalid" },
        { endpointId: "fallback", outcome: "success" },
      ],
    });
  });
});

describe("compareOutletObservations", () => {
  it("任意两条成功路径观察到不同 IP 时报告出口差异", () => {
    expect(
      compareOutletObservations([
        { ip: "198.51.100.10", country: "中国" },
        { ip: "203.0.113.42", country: "日本" },
      ]),
    ).toEqual({
      kind: "different",
      successfulPathCount: 2,
    });
  });

  it("相同 IP 的归属地冲突时仍报告出口差异", () => {
    expect(
      compareOutletObservations([
        {
          ip: "198.51.100.10",
          country: "中国",
          countryCode: "CN",
          region: "浙江",
        },
        {
          ip: "198.51.100.10",
          country: "中国",
          countryCode: "CN",
          region: "江苏",
        },
      ]),
    ).toEqual({
      kind: "different",
      successfulPathCount: 2,
    });
  });
});

describe("国内网站路径", () => {
  it("按 IPIP 返回格式读取出口结果及归属地", async () => {
    const domesticPath = DETECTION_PATHS.find(
      (path) => path.id === "domestic",
    );

    expect(domesticPath).toBeDefined();

    const result = await runDetectionPath(domesticPath!, {
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          ret: "ok",
          data: {
            ip: "112.10.247.224",
            location: ["中国", "浙江", "杭州", "", "移动"],
          },
        }),
      ),
      timeoutMs: 100,
    });

    expect(result).toMatchObject({
      status: "success",
      observation: {
        ip: "112.10.247.224",
        country: "中国",
        region: "浙江",
        city: "杭州",
        organization: "移动",
      },
      endpoint: {
        id: "ipip-json",
      },
    });
  });
});
