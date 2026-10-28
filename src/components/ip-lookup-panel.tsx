import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useIpQuery } from "@/hooks/use-ip-query";
import { DNS_SOURCE } from "@/lib/dns-lookup";
import { IP_GEO_SOURCE } from "@/lib/ip-lookup";

export function IpLookupPanel() {
  const [input, setInput] = useState("");
  const { state, domain, submit, queryAddress, announcement } = useIpQuery();
  const selectedIp = state.status === "success" ? state.info.ip : "ip" in state ? state.ip : null;
  const records = domain ? Object.values(domain.records) : [];
  const hasPartialFailure = records.some((record) => record.status === "error")
    && records.some((record) => record.status === "success" && record.addresses.length > 0);

  return (
    <section
      className="scroll-mt-16 border-y border-hairline bg-canvas px-4 py-14 sm:px-6 sm:py-20"
      id="ip-query"
      aria-labelledby="ip-query-title"
    >
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-20">
        <div>
          <h2 className="text-[clamp(30px,3.2vw,44px)] leading-tight font-semibold tracking-[-0.04em]" id="ip-query-title">
            IP 查询
          </h2>
          <p className="mt-4 max-w-[36ch] text-sm leading-6 text-body">
            输入 IP、域名或网址，查看地址的地理归属与所属网络。
          </p>
        </div>
        <div className="min-w-0">
          <form onSubmit={(event) => { event.preventDefault(); submit(input); }} noValidate>
            <label className="mb-2 block text-sm font-medium" htmlFor="ip-query-input">IP、域名或网址</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="ip-query-input"
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-hairline-strong bg-canvas px-4 font-mono text-sm text-ink outline-offset-4 placeholder:text-mute focus-visible:outline-2 focus-visible:outline-link"
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="IPv4、IPv6、域名或 https://…"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={state.status === "invalid"}
                aria-describedby={state.status === "invalid" ? "ip-query-error ip-query-privacy" : "ip-query-privacy"}
              />
              <Button type="submit" className="min-h-12 bg-ink px-7 text-white">
                查询
              </Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-body" id="ip-query-privacy">
              域名会提交给 Cloudflare DNS，目标 IP 会提交给 IPWhois。本站不保存查询历史，刷新后清空。
            </p>
          </form>
          {state.status === "invalid" ? <p className="mt-4 text-sm text-error" id="ip-query-error" role="alert">请输入一个完整的 IPv4、IPv6、域名或 HTTP/HTTPS 网址。</p> : null}
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
          <div className="mt-6">
            {state.status === "internal" ? (
              <div className="border-t border-hairline pt-6">
                <h3 className="break-all text-xl font-medium">{state.hostname}</h3>
                <p className="mt-3 text-sm text-body">内部名称不支持公共 DNS 查询。此名称未提交给第三方。</p>
              </div>
            ) : null}
            {domain ? (
              <div className="mb-6 border-t border-hairline pt-6">
                <h3 className="break-all text-xl font-medium">{domain.hostname}</h3>
                <p className="mt-2 text-xs leading-5 text-mute">解析来源：<a className="underline underline-offset-4" href={DNS_SOURCE.url} target="_blank" rel="noreferrer">{DNS_SOURCE.label}</a>。本轮查询时间：{domain.time}</p>
                {([ ["IPv4", domain.records.A], ["IPv6", domain.records.AAAA] ] as const).map(([label, record]) => (
                  <div className="mt-4" key={label} role="group" aria-label={`${label} 解析地址`}>
                    <h4 className="text-xs text-mute">{label}</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {record.status === "success" ? record.addresses.map((ip) => (
                        <button
                          className="min-h-11 max-w-full rounded-lg border border-hairline-strong px-3 py-2 text-left font-mono text-sm break-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link aria-pressed:bg-ink aria-pressed:text-canvas"
                          type="button"
                          aria-pressed={selectedIp === ip}
                          onClick={() => void queryAddress(ip)}
                          key={ip}
                        >
                          {ip}
                        </button>
                      )) : null}
                      {record.status === "loading" ? <p className="text-sm text-body">正在解析 {label}…</p> : null}
                      {record.status === "error" ? <p className="text-sm text-error" role="alert">{record.message}</p> : null}
                      {record.status === "success" && record.addresses.length === 0 ? <p className="text-sm text-body">无 {label} 地址记录</p> : null}
                    </div>
                  </div>
                ))}
                {hasPartialFailure ? <p className="mt-4 text-sm text-body">本轮解析结果可能不完整，可重新解析。</p> : null}
                <button className="mt-4 min-h-11 text-sm underline underline-offset-4" type="button" onClick={() => submit(domain.hostname)}>重新解析</button>
                <p className="mt-4 text-xs leading-5 text-mute">公共解析结果可能与本机 DNS 不同，也不代表浏览器最终连接地址；地址可能指向 CDN，并非网站源服务器或经营者的位置。</p>
              </div>
            ) : null}
            {domain && selectedIp ? <p className="mb-2 text-xs text-mute">当前 IP</p> : null}
            {state.status === "idle" && !domain ? <p className="text-sm text-mute">支持单个 IPv4、IPv6、公开域名或 HTTP/HTTPS 网址。</p> : null}
            {state.status === "loading" ? <p className="break-all text-sm text-body">正在查询 {state.ip}…</p> : null}
            {state.status === "local" ? (
              <div className="border-t border-hairline pt-6">
                <h3 className="break-all font-mono text-2xl leading-9 font-medium">{state.ip}</h3>
                <p className="mt-3 text-sm leading-6 text-body">{state.addressType}，无公网归属地。此地址未提交给第三方查询服务。</p>
              </div>
            ) : null}
            {state.status === "error" ? (
              <div className="border-t border-hairline pt-6">
                <h3 className="break-all font-mono text-2xl leading-9 font-medium">{state.ip}</h3>
                <p className="mt-3 text-sm text-error" role="alert">{state.message}</p>
                <button className="mt-3 min-h-11 text-sm underline underline-offset-4" type="button" onClick={() => void queryAddress(state.ip)}>重试归属查询</button>
              </div>
            ) : null}
            {state.status === "success" ? (
              <div className="border-t border-hairline pt-6">
                <h3 className="break-all font-mono text-2xl leading-9 font-medium">{state.info.ip}</h3>
                <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                  {[
                    ["国家/地区", state.info.country],
                    ["省州", state.info.region],
                    ["城市", state.info.city],
                    ["运营商或组织", state.info.isp],
                    ["ASN", state.info.network],
                  ].map(([label, value]) => (
                    <div className="min-w-0" key={label}>
                      <dt className="text-xs text-mute">{label}</dt>
                      <dd className="mt-1 break-words text-sm leading-6">{value || "未知"}</dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-xs text-mute">数据来源</dt>
                    <dd className="mt-1 text-sm leading-6"><a className="underline underline-offset-4" href={IP_GEO_SOURCE.url} target="_blank" rel="noreferrer">{IP_GEO_SOURCE.label}</a></dd>
                  </div>
                </dl>
                <p className="mt-6 text-xs leading-5 text-mute">归属地来自 IP 地理数据库，不代表设备的精确物理位置。</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
