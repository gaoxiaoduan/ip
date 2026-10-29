import { useEffect, useRef, useState } from "react";
import { planPingCoverage, type PingSelection } from "@/lib/ping-probes";
import { readPingResults } from "@/lib/ping-results";
import { parseLookupTarget } from "@/lib/lookup-target";
import {
  GlobalpingError,
  measurePing,
  readPingLimits,
  readPingProbes,
  type PingLimits,
  type PingMeasurement,
  type PingProbe,
} from "@/lib/globalping";

export function useMultiPing() {
  const [probes, setProbes] = useState<PingProbe[]>([]);
  const [limits, setLimits] = useState<PingLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [measurement, setMeasurement] = useState<PingMeasurement | null>(null);
  const [target, setTarget] = useState("");
  const [requested, setRequested] = useState(0);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      readPingProbes(controller.signal),
      readPingLimits(controller.signal),
    ]).then(([nodes, quota]) => {
      if (controller.signal.aborted) return;
      if (nodes.status === "fulfilled") setProbes(nodes.value);
      else
        setError(
          "Globalping API 暂不可达，无法获取在线探针。提交时会重新读取。",
        );
      if (quota.status === "fulfilled") setLimits(quota.value);
      setLoading(false);
    });
    return () => {
      controller.abort();
      active.current?.abort();
      active.current = null;
    };
  }, []);

  const start = async (
    input: string,
    ipVersion: 4 | 6,
    selection: PingSelection,
  ) => {
    if (active.current) return;
    setError("");
    const parsed = parseLookupTarget(input);
    if (!parsed) {
      setError("请输入单个完整公网 IP、公开域名或 HTTP/HTTPS 网址。");
      return;
    }
    if (
      parsed.kind === "internal" ||
      (parsed.kind === "ip" && parsed.localType)
    ) {
      setError(
        "内网、回环、保留地址及内部名称不支持远端测量，不会提交给第三方。",
      );
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setRunning(true);
    setMeasurement(null);
    setRequested(0);
    setTarget(parsed.kind === "ip" ? parsed.ip : parsed.hostname);
    try {
      const [nodes, quota] = await Promise.all([
        readPingProbes(controller.signal),
        readPingLimits(controller.signal).catch(() => null),
      ]);
      if (controller.signal.aborted) return;
      setProbes(nodes);
      setLimits(quota);
      const locations = planPingCoverage(nodes, selection).locations;
      setRequested(locations.length);
      if (!locations.length)
        throw new GlobalpingError(
          "所选范围无可用节点，请调整运营商或地区后重试。",
        );
      if (quota && quota.remaining < locations.length)
        throw new GlobalpingError(
          "免费额度不足以完成所选节点，请减少选择或等待额度恢复。",
        );
      await measurePing(
        parsed.kind === "ip" ? parsed.ip : parsed.hostname,
        parsed.kind === "domain" ? ipVersion : null,
        locations,
        controller.signal,
        (result) => {
          if (!controller.signal.aborted && active.current === controller)
            setMeasurement(result);
        },
      );
      const refreshedLimits = await readPingLimits(controller.signal).catch(
        () => null,
      );
      if (!controller.signal.aborted && active.current === controller)
        setLimits(refreshedLimits);
    } catch (cause) {
      if (!controller.signal.aborted && active.current === controller) {
        setError(
          cause instanceof GlobalpingError
            ? cause.message
            : "Globalping API 不可达或请求超时，无法判断；请手动重试。",
        );
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setRunning(false);
      }
    }
  };
  return {
    probes,
    limits,
    loading,
    running,
    error,
    results: readPingResults(measurement, Boolean(error)),
    target,
    requested,
    start,
  };
}
