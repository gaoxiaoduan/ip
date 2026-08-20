import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CONNECTIVITY_TARGETS,
  createBrowserConnectivityAdapter,
  createBrowserSpeedAdapter,
  createBrowserWebRtcAdapter,
  runConnectivityTest,
  runSpeedTest,
  runWebRtcTest,
  type ConnectivityAdapter,
  type ConnectivityObservation,
  type ConnectivityRunResult,
  type SpeedProgress,
  type SpeedProfileId,
  type SpeedTestAdapter,
  type SpeedTestResult,
  type WebRtcAdapter,
  type WebRtcCandidateEvidence,
  type WebRtcRunResult,
  type WebRtcServerResult,
} from "@/lib/network-tools";

export interface NetworkToolAdapters {
  readonly connectivity: ConnectivityAdapter;
  readonly speed: SpeedTestAdapter;
  readonly webrtc: WebRtcAdapter;
}

export type NetworkToolAdapterOverrides = Partial<NetworkToolAdapters>;

export type NetworkToolSessionStatus = "idle" | "running" | "complete" | "stopped" | "undetermined";

export interface ConnectivityToolState {
  readonly status: NetworkToolSessionStatus;
  readonly observations: readonly ConnectivityObservation[];
}

export interface WebRtcToolState {
  readonly status: NetworkToolSessionStatus;
  readonly servers: readonly WebRtcServerResult[];
  readonly candidates: readonly WebRtcCandidateEvidence[];
  readonly natReference: string | null;
}

export interface SpeedToolState {
  readonly status: NetworkToolSessionStatus;
  readonly progress: number;
  readonly phase: SpeedProgress["phase"] | null;
  readonly currentMbps: number | null;
  readonly downloadSamples: readonly number[];
  readonly uploadSamples: readonly number[];
  readonly result: SpeedTestResult | null;
  readonly profile: SpeedProfileId;
}

const DEFAULT_ADAPTERS: NetworkToolAdapters = {
  connectivity: createBrowserConnectivityAdapter(),
  speed: createBrowserSpeedAdapter(),
  webrtc: createBrowserWebRtcAdapter(),
};

const createConnectivityState = (): ConnectivityToolState => ({
  status: "idle",
  observations: [],
});

const createWebRtcState = (): WebRtcToolState => ({
  status: "idle",
  servers: [],
  candidates: [],
  natReference: null,
});

const createSpeedState = (profile: SpeedProfileId): SpeedToolState => ({
  status: "idle",
  progress: 0,
  phase: null,
  currentMbps: null,
  downloadSamples: [],
  uploadSamples: [],
  result: null,
  profile,
});

type ToolKey = "connectivity" | "speed" | "webrtc";

const mergeConnectivityObservation = (
  observations: readonly ConnectivityObservation[],
  next: ConnectivityObservation,
) => {
  const byId = new Map(observations.map((observation) => [observation.target.id, observation]));
  byId.set(next.target.id, next);
  return CONNECTIVITY_TARGETS.flatMap((target) => {
    const observation = byId.get(target.id);
    return observation ? [observation] : [];
  });
};

const mergeCandidates = (
  candidates: readonly WebRtcCandidateEvidence[],
  next: readonly WebRtcCandidateEvidence[],
) => {
  const byKey = new Map(
    candidates.map((candidate) => [
      `${candidate.address}|${candidate.type}|${candidate.scope}`,
      candidate,
    ]),
  );
  next.forEach((candidate) => {
    const key = `${candidate.address}|${candidate.type}|${candidate.scope}`;
    const existing = byKey.get(key);
    byKey.set(
      key,
      existing
        ? {
            ...existing,
            serverIds: Array.from(
              new Set([...existing.serverIds, ...candidate.serverIds]),
            ),
          }
        : candidate,
    );
  });
  return Array.from(byKey.values());
};

export function useNetworkTools(
  overrides: NetworkToolAdapterOverrides = {},
) {
  const adapters = useMemo<NetworkToolAdapters>(
    () => ({
      connectivity: overrides.connectivity ?? DEFAULT_ADAPTERS.connectivity,
      speed: overrides.speed ?? DEFAULT_ADAPTERS.speed,
      webrtc: overrides.webrtc ?? DEFAULT_ADAPTERS.webrtc,
    }),
    [overrides.connectivity, overrides.speed, overrides.webrtc],
  );
  const [connectivity, setConnectivity] = useState(createConnectivityState);
  const [webrtc, setWebrtc] = useState(createWebRtcState);
  const [speed, setSpeed] = useState(() => createSpeedState("low"));
  const mountedRef = useRef(false);
  const runIdsRef = useRef<Record<ToolKey, number>>({
    connectivity: 0,
    speed: 0,
    webrtc: 0,
  });
  const controllersRef = useRef<Record<ToolKey, AbortController | null>>({
    connectivity: null,
    speed: null,
    webrtc: null,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      Object.values(controllersRef.current).forEach((controller) => {
        controller?.abort();
      });
    };
  }, []);

  const begin = useCallback((key: ToolKey) => {
    controllersRef.current[key]?.abort();
    const controller = new AbortController();
    const runId = runIdsRef.current[key] + 1;
    runIdsRef.current[key] = runId;
    controllersRef.current[key] = controller;
    return { controller, runId };
  }, []);

  const isCurrent = useCallback(
    (key: ToolKey, runId: number) =>
      mountedRef.current && runIdsRef.current[key] === runId,
    [],
  );

  const startConnectivity = useCallback(() => {
    const { controller, runId } = begin("connectivity");
    setConnectivity({ status: "running", observations: [] });
    void runConnectivityTest(adapters.connectivity, {
      signal: controller.signal,
      onObservation: (observation) => {
        if (!isCurrent("connectivity", runId)) {
          return;
        }
        setConnectivity((current) => ({
          ...current,
          observations: mergeConnectivityObservation(
            current.observations,
            observation,
          ),
        }));
      },
    }).then((result: ConnectivityRunResult) => {
      if (!isCurrent("connectivity", runId)) {
        return;
      }
      controllersRef.current.connectivity = null;
      setConnectivity({
        status: result.status,
        observations: result.observations,
      });
    });
  }, [adapters.connectivity, begin, isCurrent]);

  const startWebrtc = useCallback(() => {
    const { controller, runId } = begin("webrtc");
    setWebrtc(createWebRtcState());
    void runWebRtcTest(adapters.webrtc, {
      signal: controller.signal,
      onServerResult: (serverResult) => {
        if (!isCurrent("webrtc", runId)) {
          return;
        }
        setWebrtc((current) => ({
          ...current,
          servers: [
            ...current.servers.filter(
              (item) => item.server.id !== serverResult.server.id,
            ),
            serverResult,
          ],
          candidates: mergeCandidates(
            current.candidates,
            serverResult.candidates,
          ),
        }));
      },
    }).then((result: WebRtcRunResult) => {
      if (!isCurrent("webrtc", runId)) {
        return;
      }
      controllersRef.current.webrtc = null;
      setWebrtc({
        status: result.status,
        servers: result.servers,
        candidates: result.candidates,
        natReference: result.natReference,
      });
    });
  }, [adapters.webrtc, begin, isCurrent]);

  const startSpeed = useCallback(
    (profile: SpeedProfileId = "low") => {
      const { controller, runId } = begin("speed");
      setSpeed({
        ...createSpeedState(profile),
        status: "running",
        phase: "latency",
      });
      void runSpeedTest(adapters.speed, {
        profile,
        signal: controller.signal,
        onProgress: (progress) => {
          if (!isCurrent("speed", runId)) {
            return;
          }
          setSpeed((current) => {
            const currentMbps = progress.sampleMbps ?? current.currentMbps;
            const downloadSamples =
              progress.phase === "download" && progress.sampleMbps !== undefined
                ? [...current.downloadSamples.slice(-35), progress.sampleMbps]
                : current.downloadSamples;
            const uploadSamples =
              progress.phase === "upload" && progress.sampleMbps !== undefined
                ? [...current.uploadSamples.slice(-35), progress.sampleMbps]
                : current.uploadSamples;
            return {
              ...current,
              progress: progress.percent,
              phase: progress.phase,
              currentMbps,
              downloadSamples,
              uploadSamples,
            };
          });
        },
      }).then((result) => {
        if (!isCurrent("speed", runId)) {
          return;
        }
        controllersRef.current.speed = null;
        setSpeed((current) => ({
          status: result.status,
          progress: result.status === "complete" ? 1 : current.progress,
          phase: null,
          currentMbps: result.uploadMbps ?? result.downloadMbps ?? current.currentMbps,
          downloadSamples: result.downloadSamples.length > 0 ? result.downloadSamples : current.downloadSamples,
          uploadSamples: result.uploadSamples.length > 0 ? result.uploadSamples : current.uploadSamples,
          result,
          profile: result.profile,
        }));
      });
    },
    [adapters.speed, begin, isCurrent],
  );

  const selectSpeedProfile = useCallback((profile: SpeedProfileId) => {
    setSpeed((current) =>
      current.status === "running"
        ? current
        : {
            ...current,
            profile,
            progress: 0,
            phase: null,
            result: null,
          },
    );
  }, []);

  const stop = useCallback((key: ToolKey) => {
    const controller = controllersRef.current[key];
    if (!controller) {
      return;
    }
    controller.abort();
    controllersRef.current[key] = null;
    if (key !== "speed") {
      runIdsRef.current[key] += 1;
    }
    if (key === "connectivity") {
      setConnectivity((current) => ({ ...current, status: "stopped" }));
    } else if (key === "webrtc") {
      setWebrtc((current) => ({ ...current, status: "stopped" }));
    } else {
      setSpeed((current) => ({ ...current, status: "stopped" }));
    }
  }, []);

  const startAll = useCallback(() => {
    startConnectivity();
    startWebrtc();
  }, [startConnectivity, startWebrtc]);

  return {
    connectivity,
    webrtc,
    speed,
    startAll,
    startConnectivity,
    startSpeed,
    startWebrtc,
    selectSpeedProfile,
    stopConnectivity: () => stop("connectivity"),
    stopSpeed: () => stop("speed"),
    stopWebrtc: () => stop("webrtc"),
  };
}
