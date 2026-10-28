import { PING_MAP_REGIONS, groupPingRegions } from "@/lib/ping-geography";
import { summarizePing, pingTime } from "@/lib/ping-results";
import type { PingRow } from "@/lib/globalping";

const latencyBand = (average: number | null) =>
  average === null
    ? "empty"
    : average <= 50
      ? "fast"
      : average <= 100
        ? "medium"
        : average <= 200
          ? "slow"
          : "high";

export function PingMap({ rows }: { rows: readonly PingRow[] }) {
  const regions = groupPingRegions(rows);
  return (
    <figure className="ping-map">
      <svg
        role="img"
        aria-label="中国地区测量地图，未测地区无数据，详细结果见节点表"
        viewBox="0 0 600 410"
      >
        {PING_MAP_REGIONS.map((region) => {
          const samples = regions.get(region.name) ?? [];
          const stats = summarizePing(samples);
          const description = !samples.length
            ? "未测，无数据"
            : stats.average !== null
              ? `${samples.length} 个节点，平均 ${pingTime(stats.average)}`
              : stats.unanswered
                ? `${samples.length} 个节点，目标未响应`
                : `${samples.length} 个节点，无法判断`;
          const band = latencyBand(stats.average);
          return (
            <g key={region.id}>
              <path
                d={region.path}
                className={`ping-region ping-region--${band}`}
              >
                <title>
                  {region.name}：{description}
                </title>
              </path>
              {samples.length ? (
                <text
                  x={region.center[0]}
                  y={region.center[1]}
                  className="ping-region-label"
                  textAnchor="middle"
                >
                  {region.name.replace(/省|市|自治区|壮族|回族|维吾尔/g, "")}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <div className="ping-map-legend">
          {[
            ["empty", "无有效延迟"],
            ["fast", "≤50 ms"],
            ["medium", "≤100 ms"],
            ["slow", "≤200 ms"],
            ["high", ">200 ms"],
          ].map(([band, label]) => (
            <span key={band}>
              <i className={`ping-swatch ping-region--${band}`} />
              {label}
            </span>
          ))}
        </div>
        <p>
          仅按实测节点着色，未测地区留灰。部分未响应与无法判断见汇总；位置由服务商提供，省份按坐标映射。
        </p>
        <a
          href="https://www.naturalearthdata.com/about/terms-of-use/"
          target="_blank"
          rel="noreferrer"
        >
          地图数据：Natural Earth · 公共领域
        </a>
      </figcaption>
    </figure>
  );
}
