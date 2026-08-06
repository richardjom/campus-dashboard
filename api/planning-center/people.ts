type ProxyPcoCredentials = {
  appId: string;
  secret: string;
};

type PeopleRequestBody = ProxyPcoCredentials & {
  pageUrl?: string;
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

type PcoApiFieldDatum = {
  type: "FieldDatum";
  id: string;
  attributes: {
    value: string | null;
  };
  relationships?: {
    customizable?: {
      data?: {
        type: string;
        id: string;
      } | null;
    };
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

type PcoApiCampus = {
  type: "Campus";
  id: string;
  attributes: {
    name: string;
  };
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
  campusName: string;
  journeyStageHint: string | null;
  gender: string;
  birthdate: string | null;
};

const PCO_BASE = "https://api.planningcenteronline.com";
const USER_AGENT = "Sunday Base Planning Center Import";
const PEOPLE_PER_PAGE = 100;
const MAX_RATE_LIMIT_RETRIES = 4;
const DEFAULT_RATE_LIMIT_WAIT_MS = 3000;
const GENERIC_CAMPUS_NAMES = new Set([
  "all campus",
  "all campuses",
  "campus",
  "church wide",
  "churchwide",
  "default campus",
  "main",
  "main campus",
]);

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
    const normalized = normalizeRequest(body);

    if (!normalized) {
      sendJson(res, 400, { error: "Missing Planning Center credentials." });
      return;
    }

    const result = await fetchPcoPeoplePage(normalized);
    sendJson(res, 200, {
      data: result.people,
      meta: {
        total: result.total,
        count: result.count,
        nextPageUrl: result.nextPageUrl,
      },
    });
  } catch (error) {
    if (error instanceof PlanningCenterApiError) {
      sendJson(res, error.statusCode, { error: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected proxy error.";
    sendJson(res, 500, { error: message });
  }
}

class PlanningCenterApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "PlanningCenterApiError";
    this.statusCode = statusCode;
  }
}

function authHeader(credentials: ProxyPcoCredentials) {
  return `Basic ${Buffer.from(`${credentials.appId}:${credentials.secret}`).toString("base64")}`;
}

async function fetchPcoPeoplePage(request: PeopleRequestBody) {
  const response = await fetchPcoPage(resolvePageUrl(request.pageUrl), request);
  const campusNamesById = await fetchCampusNames(request);

  const json = (await response.json()) as {
    data: PcoApiPerson[];
    included?: Array<PcoApiEmail | PcoApiPhone | PcoApiFieldDatum>;
    meta?: { total_count?: number; count?: number };
    links: { next?: string };
  };

  const emailsById = new Map<string, string>();
  const phonesById = new Map<string, string>();
  const fieldDataByPersonId = new Map<string, string[]>();

  for (const item of json.included ?? []) {
    if (item.type === "Email" && item.attributes.primary) {
      emailsById.set(item.id, item.attributes.address);
    }

    if (item.type === "PhoneNumber" && item.attributes.primary) {
      phonesById.set(item.id, item.attributes.number);
    }

    if (item.type === "FieldDatum") {
      const personId = item.relationships?.customizable?.data?.type === "Person"
        ? item.relationships.customizable.data.id
        : null;
      const value = item.attributes.value?.trim();

      if (!personId || !value) continue;

      const existingValues = fieldDataByPersonId.get(personId) ?? [];
      existingValues.push(value);
      fieldDataByPersonId.set(personId, existingValues);
    }
  }

  const people = json.data.map((person) => {
    const emailId = person.relationships.emails?.data.find((entry) => emailsById.has(entry.id))?.id;
    const phoneId = person.relationships.phone_numbers?.data.find((entry) => phonesById.has(entry.id))?.id;
    const primaryCampusName = person.attributes.primary_campus_id
      ? (campusNamesById.get(person.attributes.primary_campus_id) ?? "")
      : "";

    return {
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
      campusName: resolveImportedCampusName(primaryCampusName, fieldDataByPersonId.get(person.id) ?? [], campusNamesById),
      journeyStageHint: inferJourneyStageHint(person.attributes.membership ?? "Visitor", fieldDataByPersonId.get(person.id) ?? []),
      gender: person.attributes.gender ?? "",
      birthdate: person.attributes.birthdate ?? null,
    };
  });

  return {
    people,
    total: typeof json.meta?.total_count === "number" ? json.meta.total_count : people.length,
    count: typeof json.meta?.count === "number" ? json.meta.count : people.length,
    nextPageUrl: json.links.next ?? null,
  };
}

async function fetchCampusNames(credentials: ProxyPcoCredentials) {
  const response = await fetchPcoPage(`${PCO_BASE}/people/v2/campuses?per_page=100`, credentials);
  const json = (await response.json()) as {
    data?: PcoApiCampus[];
  };

  const campusNamesById = new Map<string, string>();
  for (const campus of json.data ?? []) {
    campusNamesById.set(campus.id, campus.attributes.name ?? "");
  }

  return campusNamesById;
}

function resolvePageUrl(pageUrl?: string) {
  if (!pageUrl) {
    return `${PCO_BASE}/people/v2/people?per_page=${PEOPLE_PER_PAGE}&include=emails,phone_numbers,field_data`;
  }

  if (!pageUrl.startsWith(PCO_BASE)) {
    throw new PlanningCenterApiError(400, "Invalid Planning Center page URL.");
  }

  return pageUrl;
}

function resolveImportedCampusName(
  primaryCampusName: string,
  fieldValues: string[],
  campusNamesById: Map<string, string>,
) {
  const primaryName = primaryCampusName.trim();
  const inferredCampus = inferCampusFromFieldValues(fieldValues, campusNamesById);

  if (!inferredCampus) return primaryName;
  if (!primaryName || isGenericCampusName(primaryName)) return inferredCampus;
  if (areCampusNamesEquivalent(primaryName, inferredCampus)) return primaryName;

  return primaryName;
}

function inferCampusFromFieldValues(fieldValues: string[], campusNamesById: Map<string, string>) {
  const aliasEntries = buildCampusAliasEntries(campusNamesById);

  for (const rawValue of fieldValues) {
    const normalizedValue = normalizeCampusToken(rawValue);
    if (!normalizedValue) continue;

    for (const [alias, campusName] of aliasEntries) {
      if (matchesCampusAlias(normalizedValue, alias)) {
        return campusName;
      }
    }
  }

  return "";
}

function buildCampusAliasEntries(campusNamesById: Map<string, string>) {
  const aliasMap = new Map<string, string>();

  for (const campusName of campusNamesById.values()) {
    const trimmedName = campusName.trim();
    if (!trimmedName) continue;

    for (const alias of getCampusAliases(trimmedName)) {
      if (!aliasMap.has(alias)) {
        aliasMap.set(alias, trimmedName);
      }
    }
  }

  return Array.from(aliasMap.entries()).sort((left, right) => right[0].length - left[0].length);
}

function getCampusAliases(campusName: string) {
  const aliases = new Set<string>();
  const normalized = normalizeCampusToken(campusName);

  if (normalized) aliases.add(normalized);

  const stripped = normalized
    .replace(/\bcampus\b/g, " ")
    .replace(/\blocation\b/g, " ")
    .replace(/\bsite\b/g, " ")
    .replace(/\bchurch\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped) aliases.add(stripped);

  return aliases;
}

function normalizeCampusToken(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesCampusAlias(normalizedValue: string, alias: string) {
  return (
    normalizedValue === alias ||
    normalizedValue.startsWith(`${alias} `) ||
    normalizedValue.endsWith(` ${alias}`) ||
    normalizedValue.includes(` ${alias} `)
  );
}

function isGenericCampusName(campusName: string) {
  return GENERIC_CAMPUS_NAMES.has(normalizeCampusToken(campusName));
}

function areCampusNamesEquivalent(left: string, right: string) {
  return normalizeCampusToken(left) === normalizeCampusToken(right);
}

function inferJourneyStageHint(membership: string, fieldValues: string[]) {
  const signals = [membership, ...fieldValues]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (
    signals.some((value) =>
      includesAny(value, ["team leader", "leader", "coordinator", "coach", "captain", "director"]),
    )
  ) {
    return "teamLeader";
  }

  if (
    signals.some((value) =>
      includesAny(value, [
        "dream team",
        "serve team",
        "serving team",
        "volunteer",
        "serve",
        "serving",
        "team member",
        "host team",
        "worship team",
        "production team",
        "kids team",
      ]),
    )
  ) {
    return "teamMember";
  }

  if (
    signals.some((value) =>
      includesAny(value, ["growth track", "next step", "next steps", "connect class", "connect track", "member class"]),
    )
  ) {
    return "growthTrack";
  }

  if (signals.some((value) => includesAny(value, ["first time guest", "guest"]))) {
    return "firstTimeGuest";
  }

  if (signals.some((value) => includesAny(value, ["visitor", "regular", "attendee"]))) {
    return "returningGuest";
  }

  return null;
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

async function fetchPcoPage(url: string, credentials: ProxyPcoCredentials) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader(credentials),
        "User-Agent": USER_AGENT,
      },
    });

    if (response.status === 429) {
      if (attempt === MAX_RATE_LIMIT_RETRIES) {
        throw new PlanningCenterApiError(
          429,
          "Planning Center is rate-limiting imports right now. Wait a minute, then try the import again.",
        );
      }

      await delay(getRetryDelayMs(response, attempt));
      continue;
    }

    if (!response.ok) {
      throw new PlanningCenterApiError(
        response.status,
        `Planning Center API error: ${response.status} ${response.statusText}`,
      );
    }

    return response;
  }

  throw new PlanningCenterApiError(
    429,
    "Planning Center is rate-limiting imports right now. Wait a minute, then try the import again.",
  );
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return DEFAULT_RATE_LIMIT_WAIT_MS * Math.max(1, attempt + 1);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function normalizeRequest(body: unknown): PeopleRequestBody | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const appId = typeof candidate.appId === "string" ? candidate.appId.trim() : "";
  const secret = typeof candidate.secret === "string" ? candidate.secret.trim() : "";
  const pageUrl = typeof candidate.pageUrl === "string" && candidate.pageUrl.trim()
    ? candidate.pageUrl.trim()
    : undefined;

  if (!appId || !secret) {
    return null;
  }

  return { appId, secret, pageUrl };
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
