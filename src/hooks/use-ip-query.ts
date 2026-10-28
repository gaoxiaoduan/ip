import { useEffect, useRef, useState } from "react";

import { DnsLookupError, resolveDnsAddresses, type DnsRecordType } from "@/lib/dns-lookup";
import { fetchIpGeoInfo, inspectIpAddress, IpLookupError, type IpGeoInfo } from "@/lib/ip-lookup";
import { parseLookupTarget } from "@/lib/lookup-target";

type LookupState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "internal"; hostname: string }
  | { status: "local"; ip: string; addressType: string }
  | { status: "loading"; ip: string }
  | { status: "success"; info: IpGeoInfo }
  | { status: "error"; ip: string; message: string };

type DnsFamilyState =
  | { status: "loading" }
  | { status: "success"; addresses: string[] }
  | { status: "error"; message: string };

type DomainQuery = {
  hostname: string;
  time: string;
  records: Record<DnsRecordType, DnsFamilyState>;
};

type QuerySession = {
  controller: AbortController;
  geo?: AbortController;
  selected: boolean;
  records: Record<DnsRecordType, DnsFamilyState>;
};

const loadingRecords = (): QuerySession["records"] => ({ A: { status: "loading" }, AAAA: { status: "loading" } });

function cancelSession(session: QuerySession | null) {
  session?.controller.abort();
  session?.geo?.abort();
}

function describeLookup(state: LookupState): string {
  switch (state.status) {
    case "loading": return `正在查询 ${state.ip}…`;
    case "success": return `${state.info.ip} 归属查询完成。`;
    case "error": return `${state.ip} 归属查询失败。`;
    case "local": return `${state.ip}：${state.addressType}，无公网归属地。`;
    case "internal": return "内部名称不支持公共 DNS 查询。";
    default: return "";
  }
}

export function useIpQuery() {
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const [domain, setDomain] = useState<DomainQuery | null>(null);
  const active = useRef<QuerySession | null>(null);

  useEffect(() => () => {
    cancelSession(active.current);
    active.current = null;
  }, []);

  async function queryAddress(ip: string, session = active.current) {
    if (!session || active.current !== session || session.controller.signal.aborted) return;
    session.selected = true;
    session.geo?.abort();
    const controller = new AbortController();
    session.geo = controller;
    const address = inspectIpAddress(ip)!;
    if (address.localType) {
      setState({ status: "local", ip, addressType: address.localType });
      return;
    }
    setState({ status: "loading", ip });
    try {
      const info = await fetchIpGeoInfo(ip, globalThis.fetch, controller.signal);
      if (active.current === session && !controller.signal.aborted) setState({ status: "success", info });
    } catch (error) {
      if (active.current === session && !controller.signal.aborted) {
        setState({ status: "error", ip, message: error instanceof IpLookupError ? error.message : "查询服务暂不可用，请稍后重试。" });
      }
    }
  }

  async function queryFamily(hostname: string, type: DnsRecordType, session: QuerySession) {
    let result: DnsFamilyState;
    try {
      result = { status: "success", addresses: await resolveDnsAddresses(hostname, type, session.controller.signal) };
    } catch (error) {
      result = { status: "error", message: error instanceof DnsLookupError ? error.message : "DNS 解析服务暂不可用，请重试。" };
    }
    if (active.current !== session || session.controller.signal.aborted) return;
    session.records[type] = result;
    setDomain((current) => active.current === session && current ? { ...current, records: { ...session.records } } : current);
    if (!session.selected) {
      const ipv4 = session.records.A;
      const ipv6 = session.records.AAAA;
      const ip = ipv4.status === "success" && ipv4.addresses[0]
        || (ipv4.status !== "loading" && ipv6.status === "success" && ipv6.addresses[0]);
      if (ip) void queryAddress(ip, session);
    }
  }

  function submit(input: string) {
    cancelSession(active.current);
    const session: QuerySession = { controller: new AbortController(), selected: false, records: loadingRecords() };
    active.current = session;
    setDomain(null);
    setState({ status: "idle" });
    const target = parseLookupTarget(input);
    if (!target) {
      setState({ status: "invalid" });
    } else if (target.kind === "internal") {
      setState({ status: "internal", hostname: target.hostname });
    } else if (target.kind === "ip") {
      void queryAddress(target.ip, session);
    } else {
      setDomain({ hostname: target.hostname, time: new Date().toLocaleTimeString("zh-CN", { hour12: false }), records: { ...session.records } });
      void queryFamily(target.hostname, "A", session);
      void queryFamily(target.hostname, "AAAA", session);
    }
  }

  const dnsProgress = domain ? ([ ["IPv4", domain.records.A], ["IPv6", domain.records.AAAA] ] as const).map(([label, record]) => {
    if (record.status === "loading") return `${label} 解析中`;
    if (record.status === "error") return `${label} 解析失败`;
    return `${label} ${record.addresses.length} 个地址`;
  }).join("；") + "。" : "";

  return { state, domain, submit, queryAddress, announcement: dnsProgress + describeLookup(state) };
}
