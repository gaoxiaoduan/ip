import type {
  DetectionOutcome,
  PageType,
  SourceCategory,
} from "@/lib/optimization-event-schema";

type DetectionStartedEvent = {
  event: "detection_started";
  pageType: PageType;
  sourceCategory: SourceCategory;
};

type DetectionCompletedEvent = {
  event: "detection_completed";
  pageType: PageType;
  sourceCategory: SourceCategory;
  outcome: DetectionOutcome;
};

type OptimizationEvent = DetectionStartedEvent | DetectionCompletedEvent;

const searchHostnames = ["bing.com", "baidu.com"];
const answerEngineHostnames = [
  "chatgpt.com",
  "perplexity.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "you.com",
];

const pathnameToPageType = (pathname: string): PageType => {
  switch (pathname) {
    case "/guides/ip-differences":
      return "guide-ip-differences";
    case "/guides/ip-mismatch":
      return "guide-ip-mismatch";
    case "/guides/traffic-split-observation":
      return "guide-traffic-split-observation";
    case "/methodology":
      return "methodology";
    default:
      return "home";
  }
};

const matchesHostname = (hostname: string, patterns: readonly string[]) =>
  patterns.some(
    (pattern) => hostname === pattern || hostname.endsWith(`.${pattern}`),
  );

const isGoogleHostname = (hostname: string) =>
  hostname === "google.com" ||
  hostname.startsWith("google.") ||
  hostname.endsWith(".google.com") ||
  hostname.includes(".google.");

const classifySource = (referrer: string, currentOrigin: string): SourceCategory => {
  if (!referrer) {
    return "direct";
  }

  try {
    const source = new URL(referrer);
    if (source.origin === currentOrigin) {
      return "unknown";
    }

    if (
      isGoogleHostname(source.hostname) ||
      matchesHostname(source.hostname, searchHostnames)
    ) {
      return "search";
    }

    if (matchesHostname(source.hostname, answerEngineHostnames)) {
      return "answer-engine";
    }

    return "external";
  } catch {
    return "unknown";
  }
};

const entryPageType = (referrer: string, currentOrigin: string): PageType => {
  try {
    const source = new URL(referrer);
    return source.origin === currentOrigin
      ? pathnameToPageType(source.pathname)
      : "home";
  } catch {
    return "home";
  }
};

const eventContext = () => ({
  pageType: entryPageType(document.referrer, window.location.origin),
  sourceCategory: classifySource(document.referrer, window.location.origin),
});

export const createDetectionStartedEvent = (): DetectionStartedEvent => ({
  event: "detection_started",
  ...eventContext(),
});

export const createDetectionCompletedEvent = (
  outcome: DetectionOutcome,
): DetectionCompletedEvent => ({
  event: "detection_completed",
  ...eventContext(),
  outcome,
});

export const trackOptimizationEvent = (event: OptimizationEvent) => {
  try {
    void fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Anonymous optimization events must never interrupt a detection session.
  }
};
