import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { PingMap } from "@/components/ping-map";
import { groupPingRegions } from "@/lib/ping-geography";
import { useMultiPing } from "@/hooks/use-multi-ping";
import {
  CARRIERS,
  MAX_PING_PROBES,
  carrierFor,
  pingRowState,
  selectPingLocations,
  type PingRow,
  type PingSelection,
} from "@/lib/globalping";
import { pingTime, summarizePing } from "@/lib/ping-results";
import { parseLookupTarget } from "@/lib/lookup-target";
import "./ping-page.css";

const Summary = ({
  label,
  rows,
  unidentified = 0,
}: {
  label: string;
  rows: readonly PingRow[];
  unidentified?: number;
}) => {
  const stats = summarizePing(rows);
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>
        {rows.length + unidentified} / {stats.responding}
      </td>
      <td>
        {pingTime(stats.fastest?.result.stats?.avg)}
        <small>{stats.fastest?.probe.city ?? ""}</small>
      </td>
      <td>
        {pingTime(stats.slowest?.result.stats?.avg)}
        <small>{stats.slowest?.probe.city ?? ""}</small>
      </td>
      <td>{pingTime(stats.average)}</td>
      <td>{stats.loss === null ? "—" : `${stats.loss.toFixed(1)}%`}</td>
      <td>
        {stats.unanswered} / {stats.unknown + unidentified}
      </td>
    </tr>
  );
};

export default function PingPage() {
  const session = useMultiPing();
  const [input, setInput] = useState("");
  const [ipVersion, setIpVersion] = useState<4 | 6>(4);
  const parsedInput = parseLookupTarget(input);
  const literalIp = parsedInput?.kind === "ip" ? parsedInput.ip : null;
  const [selection, setSelection] = useState<PingSelection>({
    carriers: [...CARRIERS],
    mainland: true,
    regional: false,
    overseas: false,
  });
  const selected = selectPingLocations(session.probes, selection);
  const rows = session.measurement?.results ?? [];
  const unidentified =
    session.measurement?.status === "finished" || session.error
      ? Math.max(0, (session.measurement?.probesCount ?? 0) - rows.length)
      : 0;
  const completed =
    rows.filter((row) => row.result.status !== "in-progress").length +
    unidentified;
  return (
    <div className="site-report vbg-report ping-page min-h-screen bg-canvas-soft">
      <SiteHeader brandHref="/" homeHref="/" isDetecting={false} />
      <main id="top" className="ping-shell">
        <header className="ping-intro">
          <a href="/#tools" className="ping-back">
            ← 返回网络工具台
          </a>
          <div className="ping-title-row">
            <h1>多地 Ping</h1>
            <span className="ping-tag">ICMP · 免费</span>
          </div>
          <p>从各地探针出发，比较同一目标的延迟与丢包。</p>
        </header>
        <section className="ping-controls" aria-label="测量设置">
          <p className="ping-privacy">
            测量目标和结果公开：提交给{" "}
            <a href="https://globalping.io" target="_blank" rel="noreferrer">
              Globalping
            </a>{" "}
            后，任何知道任务 ID
            的人均可读取，数据可能被发现或发布，通常保留最多六个月。本站只在当前页面展示。
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void session.start(input, ipVersion, selection);
            }}
          >
            <label className="ping-input-label" htmlFor="ping-target">
              测试目标
            </label>
            <div className="ping-input-row">
              <input
                id="ping-target"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入域名、IP 或网址，例如 example.com"
                autoComplete="off"
                spellCheck={false}
                disabled={session.running}
              />
              <Button
                data-variant="primary"
                type="submit"
                disabled={session.running || session.loading}
              >
                {session.running
                  ? "测试中…"
                  : session.measurement
                    ? "重新测试"
                    : "开始测试"}
                <span aria-hidden="true"> ↗</span>
              </Button>
            </div>
            <div className="ping-options">
              <fieldset disabled={session.running}>
                <legend>大陆运营商</legend>
                {CARRIERS.map((carrier) => (
                  <label key={carrier}>
                    <input
                      type="checkbox"
                      checked={selection.carriers.includes(carrier)}
                      onChange={(e) =>
                        setSelection((s) => ({
                          ...s,
                          carriers: e.target.checked
                            ? [...s.carriers, carrier]
                            : s.carriers.filter((c) => c !== carrier),
                        }))
                      }
                    />
                    中国{carrier}
                    <span className="ping-option-count">
                      {
                        new Set(
                          session.probes
                            .filter((p) => carrierFor(p.location) === carrier)
                            .map((p) => p.location.city),
                        ).size
                      }{" "}
                      城市
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset disabled={session.running}>
                <legend>测试地区</legend>
                {(
                  [
                    ["mainland", "中国大陆"],
                    ["regional", "港澳台"],
                    ["overseas", "海外"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={selection[key]}
                      onChange={(e) =>
                        setSelection((s) => ({ ...s, [key]: e.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              {literalIp ? (
                <span className="ping-version">
                  目标地址族：
                  {literalIp.includes(":") ? "IPv6（实验）" : "IPv4"}
                </span>
              ) : (
                <label className="ping-version">
                  域名地址族
                  <select
                    value={ipVersion}
                    disabled={session.running}
                    onChange={(e) =>
                      setIpVersion(Number(e.target.value) as 4 | 6)
                    }
                  >
                    <option value={4}>IPv4</option>
                    <option value={6}>IPv6（实验）</option>
                  </select>
                </label>
              )}
            </div>
          </form>
          <div className="ping-availability" aria-live="polite">
            <span>
              {session.loading
                ? "正在读取在线探针…"
                : `${selected.length} 个可选节点 · 每节点 5 包 · 预计消耗 ${selected.length} 个节点额度`}
            </span>
            <span>
              {session.limits
                ? `免费节点额度 ${session.limits.remaining} / ${session.limits.limit}`
                : "免费额度暂未知"}
              {session.limits?.resetsAt
                ? ` · ${new Date(session.limits.resetsAt).toLocaleTimeString("zh-CN")} 恢复`
                : ""}
            </span>
          </div>
          <p className="ping-footnote">
            大陆按三网轮流选取在线城市，同一运营商每城 1 个节点，每轮最多{" "}
            {MAX_PING_PROBES} 个。
            港澳台和海外合计最多 3 个；实际参与数以服务商返回为准。
          </p>
          {!session.loading && selection.mainland ? (
            <div className="ping-coverage">
              {selection.carriers.map((carrier) => {
                const count = selected.filter(
                  (node) => carrierFor(node) === carrier,
                ).length;
                return (
                  <span key={carrier}>
                    {count
                      ? `${carrier}：本轮可选 ${count} 个城市节点`
                      : `${carrier}：当前无可用节点`}
                  </span>
                );
              })}
            </div>
          ) : null}
          {!session.loading ? (
            <div className="ping-coverage">
              {(
                [
                  ["regional", "港澳台", selection.overseas ? 1 : 3],
                  ["overseas", "海外", selection.regional ? 2 : 3],
                ] as const
              ).map(([key, label, maximum]) => {
                if (!selection[key]) return null;
                const count = selected.filter((node) =>
                  key === "regional"
                    ? ["HK", "MO", "TW"].includes(node.country)
                    : node.country !== "CN" &&
                      !["HK", "MO", "TW"].includes(node.country),
                ).length;
                return count < maximum ? (
                  <span key={key}>
                    {count
                      ? `${label}：本轮可选 ${count} / ${maximum} 个节点`
                      : `${label}：当前无可用节点`}
                  </span>
                ) : null;
              })}
            </div>
          ) : null}
        </section>
        <div className="ping-run-status" role="status">
          <span>
            {session.error ||
              (session.running
                ? "正在测量，请等待节点返回…"
                : session.measurement
                  ? "本轮已完成"
                  : "等待开始测试")}
          </span>
          {session.target ? (
            <span className="font-mono">
              {session.target} · 请求 {session.requested} / 参与{" "}
              {session.measurement?.probesCount ?? 0} / 完成 {completed}
            </span>
          ) : null}
        </div>
        {session.measurement ? (
          <progress
            aria-label="节点测量进度"
            value={completed}
            max={Math.max(1, session.measurement.probesCount)}
          />
        ) : null}
        <div className="ping-overview">
          <section className="ping-panel">
            <div className="ping-panel-heading">
              <h2>地区观测</h2>
              <span>只显示实测证据</span>
            </div>
            <PingMap rows={rows} />
          </section>
          <section className="ping-panel">
            <div className="ping-panel-heading">
              <h2>地区与运营商</h2>
              <span>节点 / 有响应</span>
            </div>
            <div className="ping-table-scroll">
              <table aria-label="地区和运营商汇总">
                <thead>
                  <tr>
                    <th>范围</th>
                    <th>节点 / 响应</th>
                    <th>最快节点</th>
                    <th>最慢节点</th>
                    <th>平均</th>
                    <th>丢包</th>
                    <th>未响应 / 无法判断</th>
                  </tr>
                </thead>
                <tbody>
                  <Summary
                    label="全部节点"
                    rows={rows}
                    unidentified={unidentified}
                  />
                  {CARRIERS.map((carrier) => (
                    <Summary
                      key={carrier}
                      label={`中国${carrier}`}
                      rows={rows.filter((r) => carrierFor(r.probe) === carrier)}
                    />
                  ))}
                  {[...groupPingRegions(rows)].map(([label, grouped]) => (
                    <Summary key={label} label={label} rows={grouped} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ping-footnote">
              平均延迟按有效响应包加权，失败不补零；探针及解析故障单列为无法判断。
            </p>
          </section>
        </div>
        <section className="ping-panel ping-details">
          <div className="ping-panel-heading">
            <h2>节点明细</h2>
            <span>{rows.length} 个位置已知节点</span>
          </div>
          {unidentified ? (
            <p className="ping-footnote">
              {unidentified}{" "}
              个节点的元数据或结果缺失，无法判断；未将其分配到地图地区。
            </p>
          ) : null}
          <div className="ping-table-scroll">
            <table aria-label="节点明细">
              <thead>
                <tr>
                  {[
                    "探针地区 / 网络",
                    "响应 IP",
                    "状态",
                    "发 / 收 / 丢",
                    "丢包率",
                    "最低",
                    "平均",
                    "最高",
                  ].map((text) => (
                    <th key={text}>{text}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={`${row.probe.country}/${row.probe.city}/${row.probe.asn}/${i}`}
                  >
                    <th scope="row">
                      {row.probe.country} · {row.probe.city}
                      <small>
                        {carrierFor(row.probe)
                          ? `中国${carrierFor(row.probe)}`
                          : row.probe.network}{" "}
                        · AS{row.probe.asn}
                      </small>
                      <small>{row.probe.tags.join(" · ")}</small>
                    </th>
                    <td className="font-mono">
                      {row.result.resolvedAddress ?? "—"}
                    </td>
                    <td>{pingRowState(row)}</td>
                    <td>
                      {row.result.stats
                        ? `${row.result.stats.total} / ${row.result.stats.rcv} / ${row.result.stats.drop}`
                        : "—"}
                    </td>
                    <td>
                      {row.result.stats ? `${row.result.stats.loss}%` : "—"}
                    </td>
                    <td>
                      {pingTime(
                        row.result.stats?.rcv ? row.result.stats.min : null,
                      )}
                    </td>
                    <td>
                      {pingTime(
                        row.result.stats?.rcv ? row.result.stats.avg : null,
                      )}
                    </td>
                    <td>
                      {pingTime(
                        row.result.stats?.rcv ? row.result.stats.max : null,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length ? (
              <p className="ping-empty">
                开始测试后，各节点结果会在这里逐步出现。
              </p>
            ) : null}
          </div>
        </section>
        <section className="ping-method" aria-label="测量方法与隐私">
          <h2>如何理解这次测量</h2>
          <p>
            每个节点向目标发送 5 个 ICMP 包，是一次短时采样。Ping
            未响应不等于网站无法访问；这里的延迟来自远端探针，不是你的浏览器。
          </p>
          <p>
            域名由各探针分别解析，可能响应不同 CDN
            地址。想比较同一地址，请直接输入 IP。IPv6 为实验能力，不支持指定
            DNS。
          </p>
          <p>
            免费额度按公网出口共享，同一 NAT、代理出口或 IPv6
            子网可能共用额度。额度耗尽后等待恢复，不会自动重测。
          </p>
          <p>
            输入和结果不写入本站
            URL、持久存储或匿名优化事件；刷新后清空本站页面数据，Globalping
            的公开测量仍按其规则留存。
          </p>
          <a
            href="https://github.com/jsdelivr/globalping#things-to-keep-in-mind"
            target="_blank"
            rel="noreferrer"
          >
            Globalping 数据与使用说明 ↗
          </a>
        </section>
      </main>
      <footer className="ping-footer">
        <a href="/">IP 出口检测</a>
        <a href="/methodology">检测方法与隐私边界 ↗</a>
      </footer>
    </div>
  );
}
