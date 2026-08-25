export const MCP_APP_RESOURCE_URI = "ui://ip-exit-observer/observe.html";

export const MCP_APP_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; connect-src 'self' https://ip.33338888.xyz; frame-ancestors https://chatgpt.com https://claude.ai; form-action 'none'; img-src 'self'; script-src https://esm.sh 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'"
    />
    <title>IP 出口检测</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: ui-sans-serif, system-ui, sans-serif;
        background: Canvas;
        color: CanvasText;
      }

      body {
        margin: 0;
        padding: 16px;
      }

      main {
        display: grid;
        gap: 12px;
      }

      header,
      .observation {
        display: grid;
        gap: 4px;
      }

      h1,
      p,
      pre {
        margin: 0;
      }

      h1 {
        font-size: 18px;
      }

      p,
      button,
      pre {
        font-size: 13px;
      }

      p {
        opacity: 0.72;
      }

      pre {
        min-height: 140px;
        overflow: auto;
        padding: 12px;
        border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
        border-radius: 10px;
        white-space: pre-wrap;
      }

      button {
        width: fit-content;
        padding: 8px 12px;
        border: 1px solid color-mix(in srgb, CanvasText 24%, transparent);
        border-radius: 999px;
        background: Canvas;
        color: CanvasText;
        cursor: pointer;
      }

      button:disabled {
        cursor: wait;
        opacity: 0.55;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>IP 出口检测</h1>
        <p>读取当前 MCP 请求的 Cloudflare 出口观测。</p>
      </header>
      <section class="observation" aria-live="polite">
        <pre id="result">等待检测结果…</pre>
        <button id="refresh" type="button">重新读取</button>
      </section>
    </main>
    <script type="module">
      import { App } from "https://esm.sh/@modelcontextprotocol/ext-apps@1.7.5";

      const resultEl = document.getElementById("result");
      const refreshButton = document.getElementById("refresh");
      const app = new App({ name: "IP 出口检测", version: "0.1.0" });

      const readResult = (result) => {
        const structured = result?.structuredContent;
        if (structured && typeof structured === "object") {
          return structured;
        }

        const text = result?.content?.find((item) => item.type === "text")?.text;
        if (!text) {
          return { error: "未收到检测结果" };
        }

        try {
          return JSON.parse(text);
        } catch {
          return { result: text };
        }
      };

      const renderResult = (result) => {
        resultEl.textContent = JSON.stringify(readResult(result), null, 2);
      };

      app.ontoolresult = renderResult;
      app.onhostcontextchanged = (context) => {
        document.documentElement.dataset.theme = context.theme ?? "light";
      };

      refreshButton.addEventListener("click", async () => {
        refreshButton.disabled = true;
        try {
          renderResult(await app.callServerTool({ name: "observe_ip", arguments: {} }));
        } catch (error) {
          resultEl.textContent = error instanceof Error ? error.message : String(error);
        } finally {
          refreshButton.disabled = false;
        }
      });

      app.connect().catch((error) => {
        resultEl.textContent = error instanceof Error ? error.message : String(error);
      });
    </script>
  </body>
</html>`;
