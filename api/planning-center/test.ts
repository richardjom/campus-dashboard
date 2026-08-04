type ProxyPcoCredentials = {
  appId: string;
  secret: string;
};

const PCO_BASE = "https://api.planningcenteronline.com";
const USER_AGENT = "Sunday Base Planning Center Import";

export default async function handler(
  req: { body?: unknown; method?: string; on?: (event: string, cb: (chunk?: string) => void) => void },
  res: {
    status?: (code: number) => { json: (body: unknown) => void };
    statusCode?: number;
    setHeader?: (name: string, value: string) => void;
    end: (body: string) => void;
  },
) {
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

    const response = await fetch(`${PCO_BASE}/people/v2/people?per_page=1`, {
      headers: {
        Authorization: authHeader(credentials),
        "User-Agent": USER_AGENT,
      },
    });

    if (response.ok) {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (response.status === 401) {
      sendJson(res, 401, {
        ok: false,
        error: "Invalid personal access token credentials. Check your client ID and secret.",
      });
      return;
    }

    sendJson(res, 502, {
      ok: false,
      error: `Planning Center returned ${response.status}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected proxy error.";
    sendJson(res, 500, { ok: false, error: message });
  }
}

function authHeader(credentials: ProxyPcoCredentials) {
  return `Basic ${Buffer.from(`${credentials.appId}:${credentials.secret}`).toString("base64")}`;
}

async function readJsonBody(req: { body?: unknown; on?: (event: string, cb: (chunk?: string) => void) => void }) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      return req.body.trim() ? JSON.parse(req.body) : {};
    }

    return req.body;
  }

  if (typeof req.on !== "function") {
    return {};
  }

  return new Promise<unknown>((resolve, reject) => {
    let raw = "";

    req.on?.("data", (chunk) => {
      raw += typeof chunk === "string" ? chunk : String(chunk ?? "");
    });
    req.on?.("end", () => {
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
    req.on?.("error", reject);
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

function sendJson(
  res: {
    status?: (code: number) => { json: (body: unknown) => void };
    statusCode?: number;
    setHeader?: (name: string, value: string) => void;
    end: (body: string) => void;
  },
  statusCode: number,
  payload: unknown,
) {
  if (typeof res.status === "function") {
    res.status(statusCode).json(payload);
    return;
  }

  res.statusCode = statusCode;
  res.setHeader?.("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
