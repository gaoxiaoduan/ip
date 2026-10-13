import { bindings, defineConfig } from "cf/config";

/**
 * Secret-like files were detected but not read or migrated: .env, dist/ip_exit_observer/.dev.vars. Only `secrets.required` entries are migrated.
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
 */

export default defineConfig({
	worker: {
		name: "ip-exit-observer",
		compatibilityDate: "2026-07-29",
		compatibilityFlags: [
			"nodejs_compat",
		],
		entrypoint: "./worker/index.ts",
		observability: {
			enabled: true,
			logs: {
				headSamplingRate: 1,
			},
			traces: {
				enabled: true,
				headSamplingRate: 0.01,
			},
		},
		assets: {
			htmlHandling: "drop-trailing-slash",
			notFoundHandling: "single-page-application",
			runWorkerFirst: [
				"/api/*",
				"/a2a",
				"/mcp",
				"/",
			],
		},
		domains: [
			"ip.33338888.xyz",
		],
		env: {
			OPTIMIZATION_EVENTS: bindings.analyticsEngineDataset({
				name: "ip_exit_optimization_events",
			}),
			ASSETS: bindings.assets(),
		},
	},
});
