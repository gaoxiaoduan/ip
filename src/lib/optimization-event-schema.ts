export const ANALYTICS_EVENT_NAMES = [
  "detection_started",
  "detection_completed",
] as const;
export const PAGE_TYPES = [
  "home",
  "guide-ip-differences",
  "guide-ip-mismatch",
  "guide-traffic-split-observation",
  "methodology",
] as const;
export const SOURCE_CATEGORIES = [
  "search",
  "answer-engine",
  "external",
  "direct",
  "unknown",
] as const;
export const DETECTION_OUTCOMES = ["comparable", "insufficient"] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type PageType = (typeof PAGE_TYPES)[number];
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];
export type DetectionOutcome = (typeof DETECTION_OUTCOMES)[number];
