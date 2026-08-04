type ProxyPcoCredentials = {
  appId: string;
  secret: string;
};

type PcoApiPerson = {
  type: "Person";
  id: string;
  attributes: {
    first_name: string;
    last_name: string;
    membership: string;
    status: string;
    created_at: string;
    updated_at: string;
    primary_campus_id: string | null;
    gender: string;
    birthdate: string | null;
  };
  relationships: {
    emails?: { data: Array<{ type: string; id: string }> };
    phone_numbers?: { data: Array<{ type: string; id: string }> };
  };
};

type PcoApiEmail = {
  type: "Email";
  id: string;
  attributes: { address: string; primary: boolean };
};

type PcoApiPhone = {
  type: "PhoneNumber";
  id: string;
  attributes: { number: string; primary: boolean };
};

type PcoRawPerson = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  membership: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  primaryCampusId: string | null;
  gender: string;
  birthdate: string | null;
};

type PcoImportProgress = {
  loaded: number;
  total: number | null;
  page: number;
  pageCount: number | null;
  message: string;
};

const PCO_BASE = "https://api.planningcenteronline.com";
const USER_AGENT = "Sunday Base Planning Center Import";
const PEOPLE_PER_PAGE = 100;

export default async function handler(
  req: { body?: unknown; method?: string; on?: (event: string, cb: (chunk?: string) => void) => void },
  res: {
    status?: (code: number) => { json: (body: unknown) => void };
    statusCode?: number;
    setHeader?: (name: string, value: string) => void;
    flushHeaders?: () => void;
    write?: (chunk: string) => void;
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

    if (typeof res.write === "function") {
      beginNdjsonStream(res);
      writeNdjson(res, {
        type: "progress",
        loaded: 0,
        total: null,
        page: 0,
        pageCount: null,
        message: "Connected to Planning Center. Loading first page…",
      });

      const result = await fetchPcoPeople(credentials, (progress) => {
        writeNdjson(res, { type: "progress", ...progress });
      });

      writeNdjson(res, {
        type: "done",
        data: result.people,
        loaded: result.people.length,
        total: result.total,
        page: result.pageCount,
        pageCount: result.pageCount,
        message: "Import complete.",
      });
      res.end("");
      return;
    }

    const result = await fetchPcoPeople(credentials);
    sendJson(res, 200, { data: result.people });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected proxy error.";
    if (typeof res.write === "function") {
      writeNdjson(res, { type: "error", error: message });
      res.end("");
      return;
    }
    sendJson(res, 500, { error: message });
  }
}

function authHeader(credentials: ProxyPcoCredentials) {
  return `Basic ${Buffer.from(`${credentials.appId}:${credentials.secret}`).toString("base64")}`;
}

async function fetchPcoPeople(
  credentials: ProxyPcoCredentials,
  onProgress?: (progress: PcoImportProgress) => void,
) {
  const people: PcoRawPerson[] = [];
  let url: string | null = `${PCO_BASE}/people/v2/people?per_page=100&include=emails,phone_numbers`;
  let page = 0;
  let total: number | null = null;

  while (url) {
    page += 1;
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader(credentials),
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Planning Center API error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as {
      data: PcoApiPerson[];
      included?: Array<PcoApiEmail | PcoApiPhone>;
      meta?: { total_count?: number; count?: number };
      links: { next?: string };
    };

    if (typeof json.meta?.total_count === "number") {
      total = json.meta.total_count;
    }

    const emailsById = new Map<string, string>();
    const phonesById = new Map<string, string>();

    for (const item of json.included ?? []) {
      if (item.type === "Email" && item.attributes.primary) {
        emailsById.set(item.id, item.attributes.address);
      }

      if (item.type === "PhoneNumber" && item.attributes.primary) {
        phonesById.set(item.id, item.attributes.number);
      }
    }

    for (const person of json.data) {
      const emailId = person.relationships.emails?.data.find((entry) => emailsById.has(entry.id))?.id;
      const phoneId = person.relationships.phone_numbers?.data.find((entry) => phonesById.has(entry.id))?.id;

      people.push({
        id: person.id,
        firstName: person.attributes.first_name ?? "",
        lastName: person.attributes.last_name ?? "",
        email: emailId ? (emailsById.get(emailId) ?? "") : "",
        phone: phoneId ? (phonesById.get(phoneId) ?? "") : "",
        membership: person.attributes.membership ?? "Visitor",
        status: person.attributes.status ?? "active",
        createdAt: person.attributes.created_at,
        updatedAt: person.attributes.updated_at,
        primaryCampusId: person.attributes.primary_campus_id ?? null,
        gender: person.attributes.gender ?? "",
        birthdate: person.attributes.birthdate ?? null,
      });
    }

    const pageCount = total && total > 0 ? Math.ceil(total / PEOPLE_PER_PAGE) : null;
    onProgress?.({
      loaded: people.length,
      total,
      page,
      pageCount,
      message: pageCount
        ? `Loaded page ${page} of ${pageCount} from Planning Center…`
        : `Loaded ${people.length.toLocaleString()} people from Planning Center…`,
    });

    url = json.links.next ?? null;
  }

  return {
    people,
    total: total ?? people.length,
    pageCount: page,
  };
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
    flushHeaders?: () => void;
    write?: (chunk: string) => void;
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

function beginNdjsonStream(res: {
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
  flushHeaders?: () => void;
}) {
  res.statusCode = 200;
  res.setHeader?.("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader?.("Cache-Control", "no-store");
  res.flushHeaders?.();
}

function writeNdjson(
  res: {
    write?: (chunk: string) => void;
  },
  payload: unknown,
) {
  res.write?.(`${JSON.stringify(payload)}\n`);
}
