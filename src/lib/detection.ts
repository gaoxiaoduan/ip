export type DetectionPathId =
  | "domestic"
  | "ordinary-overseas"
  | "restricted-overseas";

export interface OutletObservation {
  ip: string;
  country: string;
  countryCode?: string;
  region?: string;
  city?: string;
  organization?: string;
  network?: string;
}

export interface DetectionEndpoint {
  id: string;
  label: string;
  url: string;
  source: {
    label: string;
    url: string;
  };
  redundancy: "primary" | "independent-fallback" | "compatible-fallback";
  responseType: "json" | "text";
  parse: (payload: unknown) => OutletObservation | null;
}

export interface DetectionPath {
  id: DetectionPathId;
  label: string;
  description: string;
  endpoints: readonly DetectionEndpoint[];
}

type AttemptOutcome =
  | "success"
  | "invalid"
  | "http-error"
  | "network-error"
  | "timeout";

interface DetectionAttempt {
  endpointId: string;
  outcome: AttemptOutcome;
}

export interface SuccessfulDetection {
  pathId: DetectionPathId;
  status: "success";
  observation: OutletObservation;
  endpoint: DetectionEndpoint;
  attempts: DetectionAttempt[];
  observedAt: string;
  latencyMs: number;
}

export interface UnreachableDetection {
  pathId: DetectionPathId;
  status: "unreachable";
  attempts: DetectionAttempt[];
  observedAt: string;
}

export type DetectionResult = SuccessfulDetection | UnreachableDetection;

interface RunDetectionOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
  clock?: () => number;
}

const DEFAULT_TIMEOUT_MS = 6_000;

export interface OutletComparison {
  kind: "insufficient" | "same" | "different";
  successfulPathCount: number;
}

const isIpAddress = (value: string) => {
  const candidate = value.trim();
  const ipv4Parts = candidate.split(".");
  const isIpv4 =
    ipv4Parts.length === 4 &&
    ipv4Parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        return false;
      }

      const number = Number(part);
      return number >= 0 && number <= 255;
    });

  const isIpv6 =
    candidate.includes(":") && /^[0-9a-f:.]+$/i.test(candidate);

  return isIpv4 || isIpv6;
};

export function compareOutletObservations(
  observations: readonly OutletObservation[],
): OutletComparison {
  if (observations.length < 2) {
    return {
      kind: "insufficient",
      successfulPathCount: observations.length,
    };
  }

  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  const hasConflictingValues = (
    values: readonly (string | undefined)[],
  ) =>
    new Set(
      values.flatMap((value) => (value ? [normalize(value)] : [])),
    ).size > 1;
  const countryValues = observations.map(
    (observation) => observation.countryCode ?? observation.country,
  );
  const hasDifferentOutletInformation =
    hasConflictingValues(observations.map((observation) => observation.ip)) ||
    hasConflictingValues(countryValues) ||
    hasConflictingValues(
      observations.map((observation) => observation.region),
    ) ||
    hasConflictingValues(observations.map((observation) => observation.city));

  return {
    kind: hasDifferentOutletInformation ? "different" : "same",
    successfulPathCount: observations.length,
  };
}

const isValidObservation = (
  observation: OutletObservation | null,
): observation is OutletObservation =>
  observation !== null &&
  isIpAddress(observation.ip) &&
  observation.country.trim().length > 0;

const readResponse = async (
  response: Response,
  responseType: DetectionEndpoint["responseType"],
): Promise<unknown> =>
  responseType === "json" ? response.json() : response.text();

export async function runDetectionPath(
  path: DetectionPath,
  options: RunDetectionOptions = {},
): Promise<DetectionResult> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());
  const clock = options.clock ?? (() => performance.now());
  const attempts: DetectionAttempt[] = [];

  for (const endpoint of path.endpoints) {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = clock();

    try {
      const response = await fetcher(endpoint.url, {
        cache: "no-store",
        headers: {
          Accept:
            endpoint.responseType === "json"
              ? "application/json"
              : "text/plain",
        },
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });

      if (!response.ok) {
        attempts.push({
          endpointId: endpoint.id,
          outcome: "http-error",
        });
        continue;
      }

      const payload = await readResponse(response, endpoint.responseType);
      const observation = endpoint.parse(payload);

      if (!isValidObservation(observation)) {
        attempts.push({
          endpointId: endpoint.id,
          outcome: "invalid",
        });
        continue;
      }

      attempts.push({
        endpointId: endpoint.id,
        outcome: "success",
      });

      return {
        pathId: path.id,
        status: "success",
        observation: {
          ...observation,
          ip: observation.ip.trim(),
          country: observation.country.trim(),
        },
        endpoint,
        attempts,
        observedAt: now().toISOString(),
        latencyMs: Math.max(0, Math.round(clock() - startedAt)),
      };
    } catch (error) {
      attempts.push({
        endpointId: endpoint.id,
        outcome:
          error instanceof DOMException && error.name === "AbortError"
            ? "timeout"
            : "network-error",
      });
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  return {
    pathId: path.id,
    status: "unreachable",
    attempts,
    observedAt: now().toISOString(),
  };
}
