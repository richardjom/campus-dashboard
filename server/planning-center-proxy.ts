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
  gender: string;
  birthdate: string | null;
};

const PCO_BASE = "https://api.planningcenteronline.com";
const USER_AGENT = "Sunday Base Local Import (local development)";

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
  let url: string | null =
    `${PCO_BASE}/people/v2/people?per_page=100&include=emails,phone_numbers`;

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
      included?: Array<PcoApiEmail | PcoApiPhone>;
      meta: { total_count: number; count: number };
      links: { next?: string };
    };

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

    url = json.links.next ?? null;
  }

  return people;
}
