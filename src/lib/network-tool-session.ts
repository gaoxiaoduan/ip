import {
  CONNECTIVITY_TARGETS,
  getWebRtcNatReference,
  type ConnectivityAdapter,
  type ConnectivityObservation,
  type SpeedProgress,
  type SpeedProfileId,
  type SpeedTestAdapter,
  type SpeedTestResult,
  type WebRtcAdapter,
  type WebRtcCandidateEvidence,
  type WebRtcServerResult,
  runConnectivityTest,
  runSpeedTest,
  runWebRtcTest,
} from "@/lib/network-tools";

export interface NetworkToolAdapters {
  readonly connectivity: ConnectivityAdapter;
  readonly speed: SpeedTestAdapter;
  readonly webrtc: WebRtcAdapter;
}

export type NetworkToolAdapterOverrides = Partial<NetworkToolAdapters>;

export type NetworkToolSessionStatus =
  | "idle"
  | "running"
  | "complete"
  | "stopped"
  | "undetermined";

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

export interface NetworkToolSessionSnapshot {
  readonly connectivity: ConnectivityToolState;
  readonly webrtc: WebRtcToolState;
  readonly speed: SpeedToolState;
}

export interface NetworkToolSession {
  readonly getSnapshot: () => NetworkToolSessionSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly mount: () => void;
  readonly unmount: () => void;
  readonly startAll: () => void;
  readonly startConnectivity: () => void;
  readonly startSpeed: (profile?: SpeedProfileId) => void;
  readonly startWebrtc: () => void;
  readonly selectSpeedProfile: (profile: SpeedProfileId) => void;
  readonly stopConnectivity: () => void;
  readonly stopSpeed: () => void;
  readonly stopWebrtc: () => void;
}

type ToolKey = keyof NetworkToolSessionSnapshot;

interface ToolRun {
  generation: number;
  controller: AbortController | null;
}

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

const createSnapshot = (): NetworkToolSessionSnapshot => ({
  connectivity: createConnectivityState(),
  webrtc: createWebRtcState(),
  speed: createSpeedState("low"),
});

const mergeConnectivityObservation = (
  observations: readonly ConnectivityObservation[],
  next: ConnectivityObservation,
) => {
  const byId = new Map(
    observations.map((observation) => [observation.target.id, observation]),
  );
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

export const createNetworkToolSession = (
  adapters: NetworkToolAdapters,
): NetworkToolSession => {
  let snapshot = createSnapshot();
  let mounted = false;
  const listeners = new Set<() => void>();
  const runs: Record<ToolKey, ToolRun> = {
    connectivity: { generation: 0, controller: null },
    webrtc: { generation: 0, controller: null },
    speed: { generation: 0, controller: null },
  };

  const publish = (
    update:
      | NetworkToolSessionSnapshot
      | ((current: NetworkToolSessionSnapshot) => NetworkToolSessionSnapshot),
  ) => {
    snapshot = typeof update === "function" ? update(snapshot) : update;
    listeners.forEach((listener) => listener());
  };

  const isCurrent = (key: ToolKey, runId: number) =>
    mounted &&
    runs[key].controller !== null &&
    runs[key].generation === runId;

  const invalidate = (key: ToolKey) => {
    const run = runs[key];
    run.generation += 1;
    run.controller?.abort();
    run.controller = null;
  };

  const begin = (key: ToolKey) => {
    invalidate(key);
    const controller = new AbortController();
    const run = runs[key];
    run.controller = controller;
    return { controller, runId: run.generation };
  };

  const finish = (key: ToolKey, runId: number) => {
    if (isCurrent(key, runId)) {
      runs[key].controller = null;
    }
  };

  const markConnectivityUndetermined = (runId: number) => {
    if (!isCurrent("connectivity", runId)) {
      return;
    }
    finish("connectivity", runId);
    publish((current) => ({
      ...current,
      connectivity: {
        ...current.connectivity,
        status: "undetermined",
      },
    }));
  };

  const startConnectivity = () => {
    if (!mounted) {
      return;
    }
    const { controller, runId } = begin("connectivity");
    publish((current) => ({
      ...current,
      connectivity: { status: "running", observations: [] },
    }));

    void runConnectivityTest(adapters.connectivity, {
      signal: controller.signal,
      onObservation: (observation) => {
        if (!isCurrent("connectivity", runId)) {
          return;
        }
        publish((current) => ({
          ...current,
          connectivity: {
            ...current.connectivity,
            observations: mergeConnectivityObservation(
              current.connectivity.observations,
              observation,
            ),
          },
        }));
      },
    }).then(
      (result) => {
        if (!isCurrent("connectivity", runId)) {
          return;
        }
        finish("connectivity", runId);
        publish((current) => ({
          ...current,
          connectivity: {
            status: result.status,
            observations: result.observations,
          },
        }));
      },
      () => markConnectivityUndetermined(runId),
    );
  };

  const markWebRtcUndetermined = (runId: number) => {
    if (!isCurrent("webrtc", runId)) {
      return;
    }
    finish("webrtc", runId);
    publish((current) => ({
      ...current,
      webrtc: {
        ...current.webrtc,
        status: "undetermined",
      },
    }));
  };

  const startWebrtc = () => {
    if (!mounted) {
      return;
    }
    const { controller, runId } = begin("webrtc");
    publish((current) => ({
      ...current,
      webrtc: {
        ...createWebRtcState(),
        status: "running",
      },
    }));

    const applyWebRtcServerResult = (serverResult: WebRtcServerResult) => {
      if (!isCurrent("webrtc", runId)) {
        return;
      }
      publish((current) => {
        const candidates = mergeCandidates(
          current.webrtc.candidates,
          serverResult.candidates,
        );
        return {
          ...current,
          webrtc: {
            ...current.webrtc,
            servers: [
              ...current.webrtc.servers.filter(
                (item) => item.server.id !== serverResult.server.id,
              ),
              serverResult,
            ],
            candidates,
            natReference: getWebRtcNatReference(candidates),
          },
        };
      });
    };

    void runWebRtcTest(adapters.webrtc, {
      signal: controller.signal,
      onServerProgress: applyWebRtcServerResult,
      onServerResult: applyWebRtcServerResult,
    }).then(
      (result) => {
        if (!isCurrent("webrtc", runId)) {
          return;
        }
        finish("webrtc", runId);
        publish((current) => ({
          ...current,
          webrtc: {
            status: result.status,
            servers: result.servers,
            candidates: result.candidates,
            natReference: result.natReference,
          },
        }));
      },
      () => markWebRtcUndetermined(runId),
    );
  };

  const markSpeedUndetermined = (runId: number) => {
    if (!isCurrent("speed", runId)) {
      return;
    }
    finish("speed", runId);
    publish((current) => ({
      ...current,
      speed: {
        ...current.speed,
        status: "undetermined",
        phase: null,
      },
    }));
  };

  const startSpeed = (profile: SpeedProfileId = "low") => {
    if (!mounted) {
      return;
    }
    const { controller, runId } = begin("speed");
    publish((current) => ({
      ...current,
      speed: {
        ...createSpeedState(profile),
        status: "running",
        phase: "latency",
      },
    }));

    void runSpeedTest(adapters.speed, {
      profile,
      signal: controller.signal,
      onProgress: (progress) => {
        if (!isCurrent("speed", runId)) {
          return;
        }
        publish((current) => ({
          ...current,
          speed: {
            ...current.speed,
            progress: progress.percent,
            phase: progress.phase,
            currentMbps: progress.sampleMbps ?? current.speed.currentMbps,
            downloadSamples: progress.downloadSamples,
            uploadSamples: progress.uploadSamples,
          },
        }));
      },
    }).then(
      (result) => {
        if (!isCurrent("speed", runId)) {
          return;
        }
        finish("speed", runId);
        publish((current) => ({
          ...current,
          speed: {
            status: result.status,
            progress: result.status === "complete" ? 1 : current.speed.progress,
            phase: null,
            currentMbps:
              result.uploadMbps ?? result.downloadMbps ?? current.speed.currentMbps,
            downloadSamples: result.downloadSamples,
            uploadSamples: result.uploadSamples,
            result,
            profile: result.profile,
          },
        }));
      },
      () => markSpeedUndetermined(runId),
    );
  };

  const selectSpeedProfile = (profile: SpeedProfileId) => {
    if (!mounted) {
      return;
    }
    publish((current) =>
      current.speed.status === "running"
        ? current
        : {
            ...current,
            speed: createSpeedState(profile),
          },
    );
  };

  const stop = (key: ToolKey) => {
    if (!mounted || !runs[key].controller) {
      return;
    }
    invalidate(key);
    publish((current) => {
      if (key === "connectivity") {
        return {
          ...current,
          connectivity: {
            ...current.connectivity,
            status: "stopped",
          },
        };
      }
      if (key === "webrtc") {
        return {
          ...current,
          webrtc: {
            ...current.webrtc,
            status: "stopped",
          },
        };
      }
      return {
        ...current,
        speed: {
          ...current.speed,
          status: "stopped",
          phase: null,
        },
      };
    });
  };

  const startAll = () => {
    startConnectivity();
    startWebrtc();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    mount: () => {
      mounted = true;
    },
    unmount: () => {
      mounted = false;
      (Object.keys(runs) as ToolKey[]).forEach(invalidate);
    },
    startAll,
    startConnectivity,
    startSpeed,
    startWebrtc,
    selectSpeedProfile,
    stopConnectivity: () => stop("connectivity"),
    stopSpeed: () => stop("speed"),
    stopWebrtc: () => stop("webrtc"),
  };
};
