export type ProxyPcoCredentials = {
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

export type PcoRawPerson = {
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
const USER_AGENT = "Sunday Base Local Import (local development)";
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

function authHeader(credentials: ProxyPcoCredentials) {
  return `Basic ${Buffer.from(`${credentials.appId}:${credentials.secret}`).toString("base64")}`;
}

export async function proxyTestPcoConnection(credentials: ProxyPcoCredentials): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${PCO_BASE}/people/v2/people?per_page=1`, {
      headers: {
        Authorization: authHeader(credentials),
        "User-Agent": USER_AGENT,
      },
    });

    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 401) {
      return { ok: false, error: "Invalid personal access token credentials. Check your client ID and secret." };
    }

    return { ok: false, error: `Planning Center returned ${response.status}.` };
  } catch {
    return { ok: false, error: "Could not reach Planning Center. Check your internet connection." };
  }
}

export async function proxyFetchPcoPeople(credentials: ProxyPcoCredentials) {
  const people: PcoRawPerson[] = [];
  const campusNamesById = await fetchCampusNames(credentials);
  let url: string | null =
    `${PCO_BASE}/people/v2/people?per_page=100&include=emails,phone_numbers,field_data`;

  while (url) {
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
      included?: Array<PcoApiEmail | PcoApiPhone | PcoApiFieldDatum>;
      meta: { total_count: number; count: number };
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

    for (const person of json.data) {
      const emailId = person.relationships.emails?.data.find((entry) => emailsById.has(entry.id))?.id;
      const phoneId = person.relationships.phone_numbers?.data.find((entry) => phonesById.has(entry.id))?.id;
      const primaryCampusName = person.attributes.primary_campus_id
        ? (campusNamesById.get(person.attributes.primary_campus_id) ?? "")
        : "";

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
        campusName: resolveImportedCampusName(primaryCampusName, fieldDataByPersonId.get(person.id) ?? [], campusNamesById),
        journeyStageHint: inferJourneyStageHint(person.attributes.membership ?? "Visitor", fieldDataByPersonId.get(person.id) ?? []),
        gender: person.attributes.gender ?? "",
        birthdate: person.attributes.birthdate ?? null,
      });
    }

    url = json.links.next ?? null;
  }

  return people;
}

async function fetchCampusNames(credentials: ProxyPcoCredentials) {
  const response = await fetch(`${PCO_BASE}/people/v2/campuses?per_page=100`, {
    headers: {
      Authorization: authHeader(credentials),
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Planning Center campus lookup error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    data?: Array<{ id: string; attributes: { name: string } }>;
  };

  const campusNamesById = new Map<string, string>();
  for (const campus of json.data ?? []) {
    campusNamesById.set(campus.id, campus.attributes.name ?? "");
  }

  return campusNamesById;
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
