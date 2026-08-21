import { useEffect, useMemo, useSyncExternalStore } from "react";

import {
  createBrowserConnectivityAdapter,
  createBrowserSpeedAdapter,
  createBrowserWebRtcAdapter,
} from "@/lib/network-tools";
import {
  createNetworkToolSession,
  type NetworkToolAdapterOverrides,
  type NetworkToolAdapters,
} from "@/lib/network-tool-session";

const DEFAULT_ADAPTERS: NetworkToolAdapters = {
  connectivity: createBrowserConnectivityAdapter(),
  speed: createBrowserSpeedAdapter(),
  webrtc: createBrowserWebRtcAdapter(),
};

export function useNetworkTools(
  overrides: NetworkToolAdapterOverrides = {},
) {
  const adapters = useMemo<NetworkToolAdapters>(
    () => ({
      connectivity: overrides.connectivity ?? DEFAULT_ADAPTERS.connectivity,
      speed: overrides.speed ?? DEFAULT_ADAPTERS.speed,
      webrtc: overrides.webrtc ?? DEFAULT_ADAPTERS.webrtc,
    }),
    [overrides.connectivity, overrides.speed, overrides.webrtc],
  );
  const session = useMemo(
    () => createNetworkToolSession(adapters),
    [adapters],
  );
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  useEffect(() => {
    session.mount();
    return session.unmount;
  }, [session]);

  return {
    ...snapshot,
    startAll: session.startAll,
    startConnectivity: session.startConnectivity,
    startSpeed: session.startSpeed,
    startWebrtc: session.startWebrtc,
    selectSpeedProfile: session.selectSpeedProfile,
    stopConnectivity: session.stopConnectivity,
    stopSpeed: session.stopSpeed,
    stopWebrtc: session.stopWebrtc,
  };
}
