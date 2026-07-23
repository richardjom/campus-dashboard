import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { proxyFetchPcoPeople, proxyTestPcoConnection, type ProxyPcoCredentials } from "./server/planning-center-proxy";

function planningCenterProxyPlugin(): Plugin {
  const attachMiddleware = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/planning-center/")) {
        next();
        return;
      }

      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      try {
        const body = await readJsonBody(req);
        const credentials = normalizeCredentials(body);

        if (!credentials) {
          sendJson(res, 400, { error: "Missing Planning Center credentials." });
          return;
        }

        if (req.url === "/api/planning-center/test") {
          const result = await proxyTestPcoConnection(credentials);
          sendJson(res, result.ok ? 200 : 401, result);
          return;
        }

        if (req.url === "/api/planning-center/people") {
          const people = await proxyFetchPcoPeople(credentials);
          sendJson(res, 200, { data: people });
          return;
        }

        sendJson(res, 404, { error: "Not found" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected proxy error.";
        sendJson(res, 500, { error: message });
      }
    });
  };

  return {
    name: "planning-center-proxy",
    configureServer(server) {
      attachMiddleware(server);
    },
    configurePreviewServer(server) {
      attachMiddleware(server);
    },
  };
}

function readJsonBody(req: NodeJS.ReadableStream) {
  return new Promise<unknown>((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function normalizeCredentials(body: unknown): ProxyPcoCredentials | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const appId = typeof candidate.appId === "string" ? candidate.appId.trim() : "";
  const secret = typeof candidate.secret === "string" ? candidate.secret.trim() : "";

  if (!appId || !secret) {
    return null;
  }

  return { appId, secret };
}

function sendJson(res: NodeJS.WritableStream & { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void }, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export default defineConfig({
  plugins: [react(), planningCenterProxyPlugin()],
});
