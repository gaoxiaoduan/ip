import type { PingProbe } from "@/lib/globalping";

export const MAX_PING_PROBES = 50;

export const CARRIERS = ["电信", "联通", "移动"] as const;
export type Carrier = (typeof CARRIERS)[number];
export type PingSelection = {
  carriers: readonly Carrier[];
  mainland: boolean;
  regional: boolean;
  overseas: boolean;
};

// Explicit access-network ASNs; CN cloud/education networks are not carrier samples.
const CARRIER_ASNS: Record<Carrier, readonly number[]> = {
  电信: [4134, 4812, 4809],
  联通: [4837, 9929, 4808],
  移动: [9808, 56041, 56046, 24445, 24400],
};
export const carrierFor = (
  probe: Pick<PingProbe["location"], "country" | "asn">,
): Carrier | null =>
  probe.country === "CN"
    ? (CARRIERS.find((carrier) => CARRIER_ASNS[carrier].includes(probe.asn)) ??
      null)
    : null;

export function planPingCoverage(
  probes: readonly PingProbe[],
  selection: PingSelection,
) {
  const pick = (pool: PingProbe[], limit = MAX_PING_PROBES) => {
    const selected: PingProbe[] = [];
    const cities = new Set<string>();
    for (const probe of pool.toSorted((a, b) =>
      `${a.location.country}/${a.location.city}/${a.location.asn}`.localeCompare(
        `${b.location.country}/${b.location.city}/${b.location.asn}`,
      ),
    )) {
      const key = `${probe.location.country}/${probe.location.city}`;
      if (cities.has(key)) continue;
      cities.add(key);
      selected.push(probe);
      if (cities.size === limit) break;
    }
    return selected;
  };
  const regional = new Set(["HK", "MO", "TW"]);
  const supplementalGroups = [
    {
      label: "港澳台", enabled: selection.regional,
      maximum: selection.overseas ? 1 : 3,
      pool: probes.filter((probe) => regional.has(probe.location.country)),
    },
    {
      label: "海外", enabled: selection.overseas,
      maximum: selection.regional ? 2 : 3,
      pool: probes.filter((probe) => probe.location.country !== "CN" && !regional.has(probe.location.country)),
    },
  ].filter((group) => group.enabled).map((group) => ({
    ...group, probes: pick(group.pool, group.maximum),
  }));
  const supplemental = supplementalGroups.flatMap((group) => group.probes);
  const selected: PingProbe[] = [];
  if (selection.mainland) {
    const pools = CARRIERS.filter((carrier) =>
      selection.carriers.includes(carrier),
    ).map((carrier) =>
      pick(probes.filter((p) => carrierFor(p.location) === carrier)),
    );
    const maximum = MAX_PING_PROBES - supplemental.length;
    // Take one city per carrier each round so a large network cannot crowd out others.
    for (let index = 0; selected.length < maximum; index++) {
      const round = pools.flatMap((pool) => {
        const probe = pool[index];
        return probe ? [probe] : [];
      });
      if (!round.length) break;
      selected.push(...round.slice(0, maximum - selected.length));
    }
  }
  selected.push(...supplemental);
  return {
    locations: selected.map(({ location }) => ({
      country: location.country, city: location.city, asn: location.asn, limit: 1,
    })),
    carriers: Object.fromEntries(CARRIERS.map((carrier) => [carrier, {
      available: new Set(probes.filter((probe) => carrierFor(probe.location) === carrier).map((probe) => probe.location.city)).size,
      selected: selected.filter((probe) => carrierFor(probe.location) === carrier).length,
    }])) as Record<Carrier, { available: number; selected: number }>,
    shortfalls: supplementalGroups.flatMap(({ label, probes, maximum }) =>
      probes.length < maximum ? [{ label, selected: probes.length, maximum }] : [],
    ),
  };
}

export type PingCoverage = ReturnType<typeof planPingCoverage>;
