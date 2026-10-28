import { geoContains, geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import data from "@/data/china-provinces.json";
import type { PingRow } from "@/lib/globalping";

type Province = { id: string; name: string; context: boolean };
const collection = data as FeatureCollection<Geometry, Province>;
const path = geoPath(
  geoMercator().fitExtent(
    [
      [20, 15],
      [580, 385],
    ],
    collection,
  ),
);
export const PING_MAP_REGIONS = collection.features.map((feature) => ({
  ...feature.properties,
  path: path(feature) ?? "",
  center: path.centroid(feature),
}));

export function pingProvince(probe: PingRow["probe"]) {
  if (
    probe.country !== "CN" ||
    probe.longitude == null ||
    probe.latitude == null
  )
    return null;
  const matches = collection.features.filter(
    (f) =>
      !f.properties.context &&
      geoContains(f, [probe.longitude!, probe.latitude!]),
  );
  return matches.length === 1 ? matches[0]!.properties.name : null;
}

export function groupPingRegions(rows: readonly PingRow[]) {
  const groups = new Map<string, PingRow[]>();
  for (const row of rows) {
    const name =
      pingProvince(row.probe) ??
      (row.probe.country === "CN"
        ? "大陆（省份未知）"
        : `境外 · ${row.probe.country}`);
    const group = groups.get(name) ?? [];
    group.push(row);
    groups.set(name, group);
  }
  return groups;
}
