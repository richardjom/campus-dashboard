import type { IncomingMessage, ServerResponse } from "node:http";
import { proxyFetchPcoPeople, proxyTestPcoConnection, type ProxyPcoCredentials } from "./planning-center-proxy";

type JsonResponse = ServerResponse<IncomingMessage> & {
  json?: (body: unknown) => void;
  status?: (code: number) => JsonResponse;
};

type JsonRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
  url?: string;
};

export async function handlePlanningCenterRequest(req: JsonRequest, res: JsonResponse) {
  if (!req.url?.startsWith("/api/planning-center/")) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
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
}

async function readJsonBody(req: JsonRequest) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      return req.body.trim() ? JSON.parse(req.body) : {};
    }

    return req.body;
  }

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

function sendJson(res: JsonResponse, statusCode: number, payload: unknown) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    res.status(statusCode).json(payload);
    return;
  }

  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
