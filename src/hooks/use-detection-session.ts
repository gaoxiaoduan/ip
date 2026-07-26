import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  compareOutletObservations,
  runDetectionPath,
  type DetectionPathId,
  type DetectionResult,
  type SuccessfulDetection,
} from "@/lib/detection";
import { DETECTION_PATHS } from "@/lib/endpoints";

type PendingState = {
  status: "idle" | "loading";
};

export type PathState = PendingState | DetectionResult;
type PathStateMap = Record<DetectionPathId, PathState>;

const createPathStates = (status: PendingState["status"]): PathStateMap => ({
  domestic: { status },
  "ordinary-overseas": { status },
  "restricted-overseas": { status },
});

export function useDetectionSession() {
  const [pathStates, setPathStates] = useState<PathStateMap>(() =>
    createPathStates("idle"),
  );
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const sessionRef = useRef(0);
  const mountedRef = useRef(false);
  const autoDetectionStartedRef = useRef(false);

  const detect = useCallback(async () => {
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    setCopiedIp(null);
    setPathStates(createPathStates("loading"));

    await Promise.all(
      DETECTION_PATHS.map(async (path) => {
        const result = await runDetectionPath(path);

        if (!mountedRef.current || sessionRef.current !== session) {
          return;
        }

        setPathStates((current) => ({
          ...current,
          [path.id]: result,
        }));
      }),
    );
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!autoDetectionStartedRef.current) {
      autoDetectionStartedRef.current = true;
      void detect();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [detect]);

  const successfulResults = useMemo(
    () =>
      Object.values(pathStates).filter(
        (state): state is SuccessfulDetection => state.status === "success",
      ),
    [pathStates],
  );
  const comparison = compareOutletObservations(
    successfulResults.map((result) => result.observation),
  );
  const isDetecting = Object.values(pathStates).some(
    (state) => state.status === "loading",
  );
  const unreachableCount = Object.values(pathStates).filter(
    (state) => state.status === "unreachable",
  ).length;

  const comparisonContent = isDetecting
    ? {
        kind: "loading" as const,
        label: "正在检测",
        title: "正在等待各路径返回",
        detail: "三条检测路径并行进行；同类路径只会在主检测端点失败后尝试备用检测端点。",
      }
    : comparison.kind === "different"
      ? {
          kind: "different" as const,
          label: "出口差异",
          title: "观察到出口差异",
          detail: `${comparison.successfulPathCount} 条成功路径返回了不同的出口结果（公网 IP 或出口归属地）。这只是本次访问路径的观测事实。`,
        }
      : comparison.kind === "same"
        ? {
            kind: "same" as const,
            label: "结果一致",
            title: "成功路径观察到相同出口结果",
            detail: `${comparison.successfulPathCount} 条成功路径返回了相同的公网 IP 和出口归属地。`,
          }
        : {
            kind: "insufficient" as const,
            label: "数据不足",
            title: "暂时无法比较出口",
            detail:
              unreachableCount > 0
                ? `仅 ${comparison.successfulPathCount} 条路径成功，另有 ${unreachableCount} 条路径不可达。`
                : "至少需要两条成功路径，才能比较是否存在出口差异。",
          };

  const copyIp = useCallback(async (ip: string) => {
    try {
      await navigator.clipboard.writeText(ip);
      setCopiedIp(ip);
    } catch {
      setCopiedIp(null);
    }
  }, []);

  return {
    comparisonContent,
    copiedIp,
    copyIp,
    detect,
    isDetecting,
    pathStates,
  };
}
