import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { fetchIpGeoInfo, inspectIpAddress, IP_GEO_SOURCE, IpLookupError, type IpGeoInfo } from "@/lib/ip-lookup";

type LookupState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "local"; ip: string; addressType: string }
  | { status: "loading"; ip: string }
  | { status: "success"; info: IpGeoInfo }
  | { status: "error"; ip: string; message: string };

export function IpLookupPanel() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => {
    pending.current?.abort();
    pending.current = null;
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const address = inspectIpAddress(input);
    if (!address) {
      setState({ status: "invalid" });
      return;
    }
    const ip = address.ip;
    if (address.localType) {
      setState({ status: "local", ip, addressType: address.localType });
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setState({ status: "loading", ip });
    try {
      const info = await fetchIpGeoInfo(ip, globalThis.fetch, controller.signal);
      if (!controller.signal.aborted) setState({ status: "success", info });
    } catch (error) {
      if (!controller.signal.aborted) {
        setState({ status: "error", ip, message: error instanceof IpLookupError ? error.message : "查询服务暂不可用，请稍后重试。" });
      }
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }

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
            输入一个指定 IP，查看它的地理归属与所属网络。
          </p>
        </div>
        <div className="min-w-0">
          <form onSubmit={(event) => void submit(event)} noValidate>
            <label className="mb-2 block text-sm font-medium" htmlFor="ip-query-input">IP 地址</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="ip-query-input"
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-hairline-strong bg-canvas px-4 font-mono text-sm text-ink outline-offset-4 placeholder:text-mute focus-visible:outline-2 focus-visible:outline-link"
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="IPv4 或 IPv6 地址"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={state.status === "invalid"}
                aria-describedby={state.status === "invalid" ? "ip-query-error ip-query-privacy" : "ip-query-privacy"}
              />
              <Button type="submit" disabled={state.status === "loading"} className="min-h-12 bg-ink px-7 text-white">
                {state.status === "loading" ? "查询中…" : "查询"}
              </Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-body" id="ip-query-privacy">
              查询时，目标 IP 会提交给 IPWhois。本站不保存查询历史，刷新后清空。
            </p>
          </form>
          {state.status === "invalid" ? <p className="mt-4 text-sm text-error" id="ip-query-error" role="alert">请输入一个完整的 IPv4 或 IPv6 地址。</p> : null}
          <div className="mt-6" role="status" aria-live="polite" aria-atomic="true">
            {state.status === "idle" ? <p className="text-sm text-mute">支持单个 IPv4 或 IPv6 地址。</p> : null}
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
