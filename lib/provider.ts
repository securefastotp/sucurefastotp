import "server-only";

import upstreamCatalogCache from "@/lib/upstream-catalog-cache.json";
import {
  cancelMockOrder,
  createMockOrder,
  getMockBalance,
  getMockOrder,
  listMockOrders,
  listMockServices,
} from "@/lib/mock-data";
import { getPaymentGatewayStatus } from "@/lib/payments";
import {
  getOrderFromDatabase,
  isOrderDatabaseConfigured,
  saveOrderToDatabase,
} from "@/lib/order-store";
import {
  applyPricingToService,
  computeRetailPrice,
  getPricingConfig,
  getPricingRulesForCatalog,
  getPricingRuntimeStatus,
} from "@/lib/pricing";
import { attachOrderContextToken, restoreOrderFromContextToken } from "@/lib/session-token";
import type {
  Balance,
  CatalogResponse,
  CountryOption,
  Order,
  OrderHistoryResponse,
  ProviderVariantResponse,
  RuntimeStatus,
  Service,
} from "@/lib/types";

type CatalogFilters = {
  q?: string;
  serverId?: string;
  countryId?: number | string;
  category?: string;
};

type CreateOrderInput = {
  serviceId: string;
  serviceCode: string;
  serverId: string;
  service: string;
  country: string;
  countryId: number;
  providerServerId?: string;
  providerCountryId?: number;
  providerServiceCode?: string;
  operator?: string;
  price?: number;
  currency?: string;
};

type OrderContext = {
  localOrderId: string;
  upstreamOrderId: string;
  serviceId: string;
  serviceCode: string;
  serverId: string;
  service: string;
  country: string;
  countryId: number;
  price: number;
  currency: string;
  phoneNumber: string;
  createdAt: string;
  expiresAt: string;
  providerRef?: string;
  otpCode?: string;
  status: Order["status"];
};

type UpstreamCatalogCache = {
  updatedAt: string;
  servers: Record<
    string,
    {
      countries: Array<{
        id: number;
        name: string;
        code: string;
        flagEmoji?: string;
        availableServices: number;
        serverId: string;
      }>;
      catalogs: Record<string, Service[]>;
    }
  >;
};

const defaultCountry = {
  id: 88,
  name: "Indonesia",
  code: "ID",
  flagEmoji: undefined,
};

const countryMetaMap: Record<
  number,
  {
    name: string;
    code: string;
    flagEmoji?: string;
  }
> = {
  6: {
    name: "Argentina",
    code: "AR",
  },
  88: {
    name: "Indonesia",
    code: "ID",
  },
};

const serviceNameMap: Record<string, string> = {
  wa: "WhatsApp",
  tg: "Telegram",
  fb: "Facebook",
  ig: "Instagram",
  tt: "TikTok",
  dc: "Discord",
  gg: "Google",
  sp: "Shopee",
};

const upstreamCache = upstreamCatalogCache as UpstreamCatalogCache;

const orderContextGlobal = globalThis as typeof globalThis & {
  __upstreamOrderContext?: Map<string, OrderContext>;
};

const countryCacheGlobal = globalThis as typeof globalThis & {
  __upstreamCountryCache?: Map<
    string,
    {
      countries: CountryOption[];
      expiresAt: number;
    }
  >;
};

const orderContextStore =
  orderContextGlobal.__upstreamOrderContext ?? new Map<string, OrderContext>();
orderContextGlobal.__upstreamOrderContext = orderContextStore;
const countryCacheStore =
  countryCacheGlobal.__upstreamCountryCache ?? new Map<string, { countries: CountryOption[]; expiresAt: number }>();
countryCacheGlobal.__upstreamCountryCache = countryCacheStore;

function countryCodeToFlagEmoji(code?: string) {
  if (!code || !/^[a-z]{2}$/i.test(code)) {
    return undefined;
  }

  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

export function getProviderConfig() {
  const apiKey = process.env.UPSTREAM_API_KEY;
  const requestedMode = process.env.UPSTREAM_PROVIDER_MODE;
  const mode =
    requestedMode === "rest" || (!requestedMode && apiKey) ? "rest" : "mock";
  const baseUrl = process.env.UPSTREAM_BASE_URL ?? "https://api.kirimkode.com/v1";

  return {
    mode: mode === "rest" && baseUrl && apiKey ? "rest" : "mock",
    baseUrl,
    webBaseUrl:
      process.env.UPSTREAM_WEB_BASE_URL ?? "https://kirimkode.com",
    apiKey,
    apiKeyHeader: process.env.UPSTREAM_API_KEY_HEADER ?? "x-api-key",
    balancePath: process.env.UPSTREAM_BALANCE_PATH ?? "/balance",
    historyPath: process.env.UPSTREAM_HISTORY_PATH ?? "/orders",
    orderPath: process.env.UPSTREAM_ORDER_PATH ?? "/order",
    orderStatusPath:
      process.env.UPSTREAM_ORDER_STATUS_PATH ?? "/order/{id}/status",
    cancelPath: process.env.UPSTREAM_CANCEL_PATH ?? "/order/{id}/cancel",
    orderMethod:
      process.env.UPSTREAM_ORDER_METHOD === "GET" ? "GET" : "POST",
    cancelMethod:
      process.env.UPSTREAM_CANCEL_METHOD === "DELETE" ? "DELETE" : "POST",
    timeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 15000),
    bimasaktiCode: process.env.UPSTREAM_SERVER_BIMASAKTI_CODE ?? "unified",
    marsCode: process.env.UPSTREAM_SERVER_MARS_CODE ?? "api1",
    countryCacheTtlMs: Number(process.env.UPSTREAM_COUNTRY_CACHE_TTL_MS ?? 1800000),
  } as const;
}

function getBaseHost(baseUrl?: string) {
  if (!baseUrl) {
    return null;
  }

  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function resolveServerId(serverId?: string) {
  if (serverId === "mars" || serverId === "api2") {
    return "mars";
  }

  return "bimasakti";
}

function resolveUpstreamServer(serverId?: string) {
  const config = getProviderConfig();

  if (serverId === "api1" || serverId === "api2" || serverId === "api3" || serverId === "unified") {
    return serverId;
  }

  return resolveServerId(serverId) === "mars"
    ? config.marsCode
    : config.bimasaktiCode;
}

function getServerName(serverId?: string) {
  return resolveServerId(serverId) === "mars" ? "Blueverifiy" : "Skyword";
}

function getSkywordProviderDisplayName(providerServerId: string, upstreamName: string) {
  const normalizedServer = providerServerId.trim().toLowerCase();
  const normalizedName = upstreamName.trim().toLowerCase();

  if (normalizedServer === "api1" || normalizedName === "mars") {
    return "Senja";
  }

  if (normalizedServer === "api3" || normalizedName === "saturn") {
    return "Zynn";
  }

  return upstreamName || providerServerId.toUpperCase();
}

function getSkywordProviderDisplayIcon(providerServerId: string, upstreamIcon?: string) {
  if (providerServerId === "api1") {
    return "S";
  }

  if (providerServerId === "api3") {
    return "Z";
  }

  return upstreamIcon;
}

function resolveCountryId(countryId?: number | string) {
  if (typeof countryId === "number" && Number.isFinite(countryId)) {
    return countryId;
  }

  if (typeof countryId === "string") {
    const parsed = Number(countryId);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return defaultCountry.id;
}

const countryHintMap: Record<
  number,
  {
    name: string;
    code: string;
    flagEmoji?: string;
  }
> = {
  1: { name: "Afghanistan", code: "AF" },
  2: { name: "Kazakhstan", code: "KZ" },
  3: { name: "China", code: "CN" },
  4: { name: "Philippines", code: "PH" },
  5: { name: "Myanmar", code: "MM" },
  6: { name: "Argentina", code: "AR" },
  7: { name: "Malaysia", code: "MY" },
  8: { name: "Kenya", code: "KE" },
  9: { name: "Tanzania", code: "TZ" },
  10: { name: "Vietnam", code: "VN" },
  11: { name: "Kyrgyzstan", code: "KG" },
  12: { name: "United States", code: "US" },
  13: { name: "Israel", code: "IL" },
  14: { name: "Hong Kong", code: "HK" },
  15: { name: "Poland", code: "PL" },
  16: { name: "United Kingdom", code: "GB" },
  21: { name: "Egypt", code: "EG" },
  22: { name: "India", code: "IN" },
  25: { name: "Laos", code: "LA" },
  31: { name: "South Africa", code: "ZA" },
  32: { name: "Romania", code: "RO" },
  33: { name: "Colombia", code: "CO" },
  34: { name: "Estonia", code: "EE" },
  35: { name: "Azerbaijan", code: "AZ" },
  36: { name: "Canada", code: "CA" },
  37: { name: "Morocco", code: "MA" },
  39: { name: "Argentina", code: "AR" },
  40: { name: "Uzbekistan", code: "UZ" },
  61: { name: "Pakistan", code: "PK" },
  88: { name: "Indonesia", code: "ID" },
};

function normalizeCountryLookupName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

const countryNameAliases = new Map<string, string>(
  [
    ["afganistan", "AF"],
    ["america", "US"],
    ["bolivia", "BO"],
    ["bosnia", "BA"],
    ["brunei", "BN"],
    ["cad", "TD"],
    ["cape verde", "CV"],
    ["chili", "CL"],
    ["cina", "CN"],
    ["congo", "CG"],
    ["czech republic", "CZ"],
    ["democratic republic of the congo", "CD"],
    ["dr congo", "CD"],
    ["east timor", "TL"],
    ["england", "GB"],
    ["guinea khatulistiwa", "GQ"],
    ["guyana perancis", "GF"],
    ["hongkong", "HK"],
    ["inggris", "GB"],
    ["iran", "IR"],
    ["ivory coast", "CI"],
    ["kongo", "CG"],
    ["kongo dr", "CD"],
    ["kosovo", "XK"],
    ["laos", "LA"],
    ["macau", "MO"],
    ["makau", "MO"],
    ["moldova", "MD"],
    ["north korea", "KP"],
    ["palestina", "PS"],
    ["palestine", "PS"],
    ["pantai gading", "CI"],
    ["papua", "PG"],
    ["russia", "RU"],
    ["rusia", "RU"],
    ["saint kitts", "KN"],
    ["saint kitts and nevis", "KN"],
    ["saint vincent", "VC"],
    ["saint vincent grenadines", "VC"],
    ["sao tome dan prinsip", "ST"],
    ["slowakia", "SK"],
    ["south korea", "KR"],
    ["syria", "SY"],
    ["taiwan", "TW"],
    ["tanzania", "TZ"],
    ["the netherlands", "NL"],
    ["turkey", "TR"],
    ["u k", "GB"],
    ["uk", "GB"],
    ["united states virtual", "US"],
    ["united states of america", "US"],
    ["usa", "US"],
    ["venezuela", "VE"],
    ["vietnam", "VN"],
  ].map(([name, code]) => [normalizeCountryLookupName(name), code]),
);

const fallbackRegionCodes = [
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AW",
  "AX",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BL",
  "BM",
  "BN",
  "BO",
  "BQ",
  "BR",
  "BS",
  "BT",
  "BV",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CC",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CK",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CU",
  "CV",
  "CW",
  "CX",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "EH",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FK",
  "FM",
  "FO",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GF",
  "GG",
  "GH",
  "GI",
  "GL",
  "GM",
  "GN",
  "GP",
  "GQ",
  "GR",
  "GS",
  "GT",
  "GU",
  "GW",
  "GY",
  "HK",
  "HM",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IM",
  "IN",
  "IO",
  "IQ",
  "IR",
  "IS",
  "IT",
  "JE",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KP",
  "KR",
  "KW",
  "KY",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MF",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MO",
  "MP",
  "MQ",
  "MR",
  "MS",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NC",
  "NE",
  "NF",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NU",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PF",
  "PG",
  "PH",
  "PK",
  "PL",
  "PM",
  "PN",
  "PR",
  "PS",
  "PT",
  "PW",
  "PY",
  "QA",
  "RE",
  "RO",
  "RS",
  "RU",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SH",
  "SI",
  "SJ",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SX",
  "SY",
  "SZ",
  "TC",
  "TD",
  "TF",
  "TG",
  "TH",
  "TJ",
  "TK",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "UM",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VG",
  "VI",
  "VN",
  "VU",
  "WF",
  "WS",
  "XK",
  "YE",
  "YT",
  "ZA",
  "ZM",
  "ZW",
];

let countryNameCodeMap: Map<string, string> | null = null;

function getCountryNameCodeMap() {
  if (countryNameCodeMap) {
    return countryNameCodeMap;
  }

  const supportedValuesOf = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;
  const supportedRegionCodes = (() => {
    try {
      return supportedValuesOf?.("region").filter((code) => /^[A-Z]{2}$/.test(code));
    } catch {
      return null;
    }
  })();
  const regionCodes =
    supportedRegionCodes && supportedRegionCodes.length > 0
      ? supportedRegionCodes
      : fallbackRegionCodes;
  const map = new Map(countryNameAliases);

  for (const code of regionCodes) {
    map.set(normalizeCountryLookupName(code), code);

    for (const locale of ["en", "id"]) {
      try {
        const displayName = new Intl.DisplayNames([locale], {
          type: "region",
        }).of(code);

        if (displayName) {
          map.set(normalizeCountryLookupName(displayName), code);
        }
      } catch {
        // Keep country flags best-effort if a runtime lacks DisplayNames data.
      }
    }
  }

  countryNameCodeMap = map;
  return map;
}

function getCountryMeta(countryId?: number | string) {
  const resolvedId = resolveCountryId(countryId);

  const knownMeta = countryHintMap[resolvedId] ?? countryMetaMap[resolvedId];

  if (knownMeta) {
    return {
      id: resolvedId,
      name: knownMeta.name,
      code: knownMeta.code,
      flagEmoji: knownMeta.flagEmoji ?? countryCodeToFlagEmoji(knownMeta.code),
    };
  }

  return {
    id: resolvedId,
    name: `Country ID ${resolvedId}`,
    code: "",
    flagEmoji: undefined,
  };
}

function getCachedCountries(serverId: string): CountryOption[] {
  const serverCache = upstreamCache.servers[resolveServerId(serverId)];

  if (!serverCache) {
    return [];
  }

  return serverCache.countries.map((country) => {
    const meta = getCountryMeta(country.id);
    const code =
      country.code && /^[a-z]{2}$/i.test(country.code) ? country.code : meta.code;

    return {
      ...country,
      name:
        country.name && !country.name.toLowerCase().startsWith("country ")
          ? country.name
          : meta.name,
      code,
      flagEmoji: countryCodeToFlagEmoji(code) ?? meta.flagEmoji,
    };
  });
}

function getCachedCatalog(serverId: string, countryId: number) {
  const serverCache = upstreamCache.servers[resolveServerId(serverId)];

  if (!serverCache) {
    return [];
  }

  const cachedCountry = serverCache.countries.find((country) => country.id === countryId);

  return ((serverCache.catalogs[String(countryId)] ?? []) as Service[]).map(
    (service) =>
      normalizeCachedService(service, {
        serverId,
        countryId,
        country: cachedCountry
          ? {
              name: cachedCountry.name,
              code: cachedCountry.code,
              flagEmoji: cachedCountry.flagEmoji,
            }
          : undefined,
      }),
  );
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildCatalogResponse(
  services: Service[],
  mode: RuntimeStatus["providerMode"],
  extras?: {
    source?: "upstream" | "fallback";
    warning?: string;
  },
): CatalogResponse {
  return {
    updatedAt: new Date().toISOString(),
    mode,
    total: services.length,
    countries: uniqueSorted(services.map((service) => service.country)),
    categories: uniqueSorted(services.map((service) => service.category)),
    services,
    source: extras?.source,
    warning: extras?.warning,
  };
}

function normalizeCachedService(
  service: Service,
  context: {
    serverId: string;
    countryId: number;
    country?: {
      name?: string;
      code?: string;
      flagEmoji?: string;
    };
  },
) {
  const countryMeta = getCountryMeta(context.countryId);
  const countryName =
    context.country?.name && !context.country.name.toLowerCase().startsWith("country ")
      ? context.country.name
      : countryMeta.name;
  const countryCode =
    context.country?.code && /^[a-z]{2}$/i.test(context.country.code)
      ? context.country.code
      : countryMeta.code;
  const serviceCode = service.serviceCode || service.id || service.slug;
  const upstreamPrice =
    Number.isFinite(service.upstreamPrice) && service.upstreamPrice > 0
      ? service.upstreamPrice
      : service.price;
  const stock =
    typeof service.stock === "number" && Number.isFinite(service.stock)
      ? service.stock
      : 0;

  return {
    ...service,
    id: `${context.serverId}-${countryMeta.id}-${serviceCode}`,
    slug: `${context.serverId}-${countryMeta.id}-${serviceCode}`,
    serverId: resolveServerId(context.serverId),
    serviceCode,
    service: formatServiceName(serviceCode, service.service),
    country: countryName,
    countryId: countryMeta.id,
    countryCode,
    category: service.category || "OTP",
    upstreamPrice,
    price: computeRetailPrice(upstreamPrice),
    stock,
    currency: service.currency || getPricingConfig().currency,
    deliveryEtaSeconds:
      typeof service.deliveryEtaSeconds === "number" &&
      Number.isFinite(service.deliveryEtaSeconds)
        ? service.deliveryEtaSeconds
        : 20,
    tags: ["KirimKode Cache", getServerName(context.serverId)],
  } satisfies Service;
}

function pickString(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return fallback;
}

function pickNumber(record: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function extractArray(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.data)) {
    return record.data;
  }

  return [];
}

function extractRecord(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;

  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    return record.data as Record<string, unknown>;
  }

  return record;
}

function extractTimestamp(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  return pickString(record, ["timestamp"], fallback);
}

function buildPathWithQuery(
  path: string,
  query: Record<string, string | number | undefined>,
) {
  const base = new URL(path, "https://kirimkode.local");

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") {
      continue;
    }

    base.searchParams.set(key, String(value));
  }

  return `${base.pathname}${base.search}`;
}

export function buildUpstreamUrl(baseUrl: string, path: string) {
  const url = new URL(baseUrl);
  const queryIndex = path.indexOf("?");
  const pathOnly = queryIndex >= 0 ? path.slice(0, queryIndex) : path;
  const search = queryIndex >= 0 ? path.slice(queryIndex) : "";
  const normalizedPath = pathOnly.startsWith("/") ? pathOnly.slice(1) : pathOnly;
  const basePath = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;

  url.pathname = `${basePath}${normalizedPath}`;
  url.search = search;

  return url;
}

function normalizeStatus(input: string, hasOtpCode = false) {
  if (hasOtpCode) {
    return "otp_received" as const;
  }

  const value = input.toLowerCase();

  if (["otp_received", "received", "success", "done", "completed"].includes(value)) {
    return "otp_received" as const;
  }

  if (["expired", "timeout"].includes(value)) {
    return "expired" as const;
  }

  if (["cancelled", "canceled", "cancel"].includes(value)) {
    return "cancelled" as const;
  }

  return "pending" as const;
}

function formatServiceName(serviceCode: string, fallback?: string) {
  if (fallback) {
    return fallback;
  }

  return serviceNameMap[serviceCode] ?? serviceCode.toUpperCase();
}

async function fetchLiveServices(serverId: string, countryId: number) {
  const resolvedServerId = resolveServerId(serverId);
  const country = await getWebCountryMeta(resolvedServerId, countryId);
  const payload = await fetchKirimKodeWeb(
    buildPathWithQuery("/api/otp/layanan", {
      server: resolveWebServer(resolvedServerId),
      negara: countryId,
    }),
  );
  const entries = extractWebServiceEntries(payload, countryId);
  const provider =
    resolvedServerId === "mars"
      ? {
          serverId: resolveUpstreamServer(resolvedServerId),
          name: getServerName(resolvedServerId),
          countryId,
          serviceCode: "",
        }
      : undefined;

  return entries
    .map((entry) =>
      normalizeWebService(entry, {
        serverId: resolvedServerId,
        country,
        provider: provider
          ? {
              ...provider,
              serviceCode: entry[0],
            }
          : undefined,
      }),
    )
    .filter((service): service is Service => Boolean(service));
}

async function fetchWebCountries(serverId: string) {
  const payload = await fetchKirimKodeWeb(
    buildPathWithQuery("/api/otp/negara", {
      server: resolveWebServer(serverId),
    }),
  );
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const data = Array.isArray(record.data) ? record.data : [];

  return data
    .map((item): CountryOption | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const countryRecord = item as Record<string, unknown>;
      const id = pickNumber(countryRecord, ["id_negara", "id"], NaN);
      const name = pickString(countryRecord, ["nama_negara", "name"], "");

      if (!Number.isFinite(id) || !name) {
        return null;
      }

      const code = countryNameToCode(name);

      return {
        id,
        name,
        code,
        flagEmoji: countryCodeToFlagEmoji(code),
        availableServices: 0,
        serverId: resolveServerId(serverId),
      } satisfies CountryOption;
    })
    .filter((country): country is CountryOption => country !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function countryNameToCode(name: string) {
  const normalized = normalizeCountryLookupName(name);
  const known = Object.values(countryHintMap).find(
    (country) => normalizeCountryLookupName(country.name) === normalized,
  );

  if (known?.code && /^[a-z]{2}$/i.test(known.code)) {
    return known.code;
  }

  return getCountryNameCodeMap().get(normalized) ?? "";
}

async function getWebCountryMeta(serverId: string, countryId: number) {
  const cacheKey = `web-country:${resolveWebServer(serverId)}`;
  const cached = countryCacheStore.get(cacheKey);
  const countries =
    cached && cached.expiresAt > Date.now()
      ? cached.countries
      : await fetchWebCountries(serverId);

  if (!cached || cached.expiresAt <= Date.now()) {
    countryCacheStore.set(cacheKey, {
      countries,
      expiresAt:
        Date.now() +
        (Number.isFinite(getProviderConfig().countryCacheTtlMs)
          ? getProviderConfig().countryCacheTtlMs
          : 1800000),
    });
  }

  const country = countries.find((item) => item.id === countryId);

  if (country) {
    return {
      id: country.id,
      name: country.name,
      code: country.code,
      flagEmoji: country.flagEmoji,
    };
  }

  return getCountryMeta(countryId);
}

function applyFilters(services: Service[], filters: CatalogFilters) {
  const q = filters.q?.trim().toLowerCase();
  const serverId = filters.serverId ? resolveServerId(filters.serverId) : null;
  const countryId = filters.countryId ? resolveCountryId(filters.countryId) : null;

  return services.filter((service) => {
    const matchesQuery =
      !q ||
      `${service.service} ${service.serviceCode} ${service.country} ${service.tags.join(" ")}`
        .toLowerCase()
        .includes(q);

    const matchesServer = !serverId || service.serverId === serverId;
    const matchesCountry = !countryId || service.countryId === countryId;
    const matchesCategory =
      !filters.category || service.category === filters.category;

    return matchesQuery && matchesServer && matchesCountry && matchesCategory;
  });
}

async function fetchUpstream(
  path: string,
  options?: {
    method?: "GET" | "POST" | "DELETE";
    body?: Record<string, unknown>;
  },
) {
  const config = getProviderConfig();

  if (config.mode !== "rest" || !config.baseUrl || !config.apiKey) {
    throw new Error("Provider upstream belum dikonfigurasi.");
  }

  const url = buildUpstreamUrl(config.baseUrl, path);
  const headers = new Headers({
    Accept: "application/json",
  });

  if (options?.body) {
    headers.set("Content-Type", "application/json");
  }

  if (config.apiKeyHeader.toLowerCase() === "authorization") {
    headers.set("Authorization", `Bearer ${config.apiKey}`);
  } else {
    headers.set(config.apiKeyHeader, config.apiKey);
  }

  const response = await fetch(url, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(
      Number.isFinite(config.timeoutMs) ? config.timeoutMs : 15000,
    ),
  });

  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;

  if (
    payload &&
    !Array.isArray(payload) &&
    "success" in payload &&
    payload.success === false
  ) {
    const errorRecord =
      payload.error && typeof payload.error === "object" && !Array.isArray(payload.error)
        ? (payload.error as Record<string, unknown>)
        : null;
    const errorMessage =
      (errorRecord && pickString(errorRecord, ["message"], "")) ||
      pickString(payload, ["message"], "Provider upstream mengembalikan status gagal.");

    throw new Error(errorMessage);
  }

  if (!response.ok) {
    const message =
      (payload &&
        !Array.isArray(payload) &&
        pickString(payload, ["message"], "")) ||
      `Provider upstream merespons HTTP ${response.status}.`;

    throw new Error(message);
  }

  return payload;
}

async function fetchKirimKodeWeb(path: string) {
  const config = getProviderConfig();
  const url = buildUpstreamUrl(config.webBaseUrl, path);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(
      Number.isFinite(config.timeoutMs) ? config.timeoutMs : 15000,
    ),
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(`KirimKode web API merespons HTTP ${response.status}.`);
  }

  return payload;
}

function resolveWebServer(serverId?: string) {
  return resolveServerId(serverId) === "mars"
    ? getProviderConfig().marsCode
    : getProviderConfig().bimasaktiCode;
}

function extractWebServiceEntries(payload: unknown, countryId: number) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [] as Array<[string, Record<string, unknown>]>;
  }

  const record = payload as Record<string, unknown>;
  const countryKey = String(countryId);
  const nested =
    (record[countryKey] && typeof record[countryKey] === "object"
      ? record[countryKey]
      : null) ??
    (record.data &&
    typeof record.data === "object" &&
    !Array.isArray(record.data) &&
    (record.data as Record<string, unknown>)[countryKey] &&
    typeof (record.data as Record<string, unknown>)[countryKey] === "object"
      ? (record.data as Record<string, unknown>)[countryKey]
      : null);
  const source =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : record;

  return Object.entries(source).filter(
    (entry): entry is [string, Record<string, unknown>] => {
      const value = entry[1];

      return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "layanan" in value
      );
    },
  );
}

function normalizeWebService(
  entry: [string, Record<string, unknown>],
  context: {
    serverId: string;
    country: {
      id: number;
      name: string;
      code: string;
      flagEmoji?: string;
    };
    provider?: {
      serverId: string;
      name: string;
      icon?: string;
      countryId: number;
      serviceCode: string;
    };
  },
): Service | null {
  const [serviceCode, record] = entry;
  const upstreamPrice = pickNumber(record, ["harga", "price"], 0);

  if (!serviceCode || upstreamPrice <= 0) {
    return null;
  }

  const stock = pickNumber(record, ["stok", "stock"], 0);
  const serviceName = formatServiceName(
    serviceCode,
    pickString(record, ["layanan", "name"], ""),
  );

  return {
    id: `${context.serverId}-${context.country.id}-${serviceCode}${
      context.provider?.serverId ? `-${context.provider.serverId}` : ""
    }`,
    slug: `${context.serverId}-${context.country.id}-${serviceCode}${
      context.provider?.serverId ? `-${context.provider.serverId}` : ""
    }`,
    serverId: context.serverId,
    serviceCode,
    service: serviceName,
    providerServerId: context.provider?.serverId,
    providerName: context.provider?.name,
    providerIcon: context.provider?.icon,
    providerCountryId: context.provider?.countryId,
    providerServiceCode: context.provider?.serviceCode,
    country: context.country.name,
    countryId: context.country.id,
    countryCode: context.country.code,
    category: "OTP",
    upstreamPrice,
    price: computeRetailPrice(upstreamPrice),
    stock,
    currency: getPricingConfig().currency,
    deliveryEtaSeconds: 20,
    tags: [
      "KirimKode Web",
      getServerName(context.serverId),
      ...(context.provider?.name ? [context.provider.name] : []),
    ],
  } satisfies Service;
}

function replaceOrderId(pathTemplate: string, orderId: string) {
  return pathTemplate
    .replace("{id}", encodeURIComponent(orderId))
    .replace(":id", encodeURIComponent(orderId));
}

function normalizeCreatedOrder(
  payload: unknown,
  fallback: Omit<OrderContext, "phoneNumber" | "createdAt" | "expiresAt" | "status">,
) {
  const record = extractRecord(payload);
  const createdAtFallback = new Date().toISOString();
  const createdAt = extractTimestamp(payload, createdAtFallback);
  const expiresAt = pickString(
    record,
    ["expires_at", "expiresAt"],
    new Date(Date.now() + 20 * 60 * 1000).toISOString(),
  );
  const phoneNumber = pickString(record, ["number", "phoneNumber", "phone"], "-");
  const orderId = pickString(record, ["order_id", "id", "orderId"], "");
  const localOrderId = orderId || pickString(record, ["id"], "") || fallback.localOrderId;
  const providerRef =
    pickString(record, ["id"], "") && pickString(record, ["id"], "") !== localOrderId
      ? pickString(record, ["id"], "")
      : undefined;

  return {
    id: localOrderId,
    serviceId: fallback.serviceId,
    serviceCode: fallback.serviceCode,
    serverId: fallback.serverId,
    service: fallback.service,
    country: fallback.country,
    countryId: fallback.countryId,
    phoneNumber,
    price: fallback.price,
    currency: fallback.currency,
    status: "pending" as const,
    createdAt,
    expiresAt,
    providerRef,
  } satisfies Order;
}

function normalizeStatusOrder(
  payload: unknown,
  context: OrderContext,
) {
  const record = extractRecord(payload);
  const otpCode = pickString(record, ["code"], "") || undefined;
  let status = normalizeStatus(
    pickString(record, ["status"], context.status),
    Boolean(otpCode),
  );
  const payloadId = pickString(record, ["id"], "");
  const payloadOrderId = pickString(record, ["order_id", "orderId"], "");
  const detectedProviderRef = [payloadId, payloadOrderId].find(
    (candidate) => candidate && candidate !== context.localOrderId,
  );

  if (
    status === "pending" &&
    Date.now() > new Date(context.expiresAt).getTime()
  ) {
    status = "expired";
  }

  return {
    id: context.localOrderId,
    serviceId: context.serviceId,
    serviceCode: context.serviceCode,
    serverId: context.serverId,
    service: context.service,
    country: context.country,
    countryId: context.countryId,
    phoneNumber:
      pickString(record, ["number", "phoneNumber", "phone"], context.phoneNumber) ||
      context.phoneNumber,
    price: context.price,
    currency: context.currency,
    status,
    otpCode,
    createdAt: context.createdAt,
    expiresAt: context.expiresAt,
    providerRef: context.providerRef ?? detectedProviderRef,
  } satisfies Order;
}

function normalizeBalance(payload: unknown): Balance {
  const record = extractRecord(payload);

  return {
    amount: pickNumber(record, ["balance"], 0),
    currency: pickString(record, ["currency"], getPricingConfig().currency),
    updatedAt: extractTimestamp(payload, new Date().toISOString()),
    mode: getProviderConfig().mode,
  };
}

function normalizeHistory(payload: unknown): OrderHistoryResponse {
  const orders = extractArray(payload)
    .map((item): Order | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const serviceCode = pickString(record, ["service", "code"], "unknown");
      const orderId = pickString(record, ["order_id", "id", "orderId"], "");
      const otpCode = pickString(record, ["code"], "") || undefined;
      const status = normalizeStatus(
        pickString(record, ["status"], "pending"),
        Boolean(otpCode),
      );
      const timestamp = pickString(
        record,
        ["created_at", "createdAt", "updated_at", "updatedAt"],
        extractTimestamp(payload, new Date().toISOString()),
      );
      const countryLabel = pickString(record, ["country"], "") || defaultCountry.name;
      const countryMeta = /^\d+$/.test(countryLabel)
        ? getCountryMeta(Number(countryLabel))
        : null;
      const serverId = resolveServerId(pickString(record, ["server"], ""));

      return {
        id: orderId || pickString(record, ["id"], ""),
        serviceId: serviceCode,
        serviceCode,
        service: formatServiceName(serviceCode),
        serverId,
        country: countryMeta?.name ?? countryLabel,
        countryId: countryMeta?.id ?? defaultCountry.id,
        phoneNumber: pickString(record, ["number", "phoneNumber"], "-"),
        price: pickNumber(record, ["price"], 0),
        currency: getPricingConfig().currency,
        status,
        otpCode,
        createdAt: timestamp,
        expiresAt: timestamp,
        providerRef:
          pickString(record, ["id"], "") !== orderId
            ? pickString(record, ["id"], "") || undefined
            : undefined,
      } satisfies Order;
    })
    .filter((order): order is Order => order !== null);

  const payloadRecord =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const pagination =
    payloadRecord.pagination &&
    typeof payloadRecord.pagination === "object" &&
    !Array.isArray(payloadRecord.pagination)
      ? (payloadRecord.pagination as Record<string, unknown>)
      : {};

  return {
    updatedAt: extractTimestamp(payload, new Date().toISOString()),
    mode: getProviderConfig().mode,
    total: pickNumber(pagination, ["total"], orders.length),
    orders,
  };
}

async function resolveProviderRefFromHistory(context: OrderContext) {
  try {
    const history = await getHistory();
    const currentCreatedAt = new Date(context.createdAt).getTime();
    const directMatch = history.orders.find(
      (order) =>
        order.id === context.localOrderId ||
        order.providerRef === context.localOrderId,
    );
    const fallbackMatch = history.orders.find((order) => {
      const samePhone = order.phoneNumber === context.phoneNumber;
      const sameService =
        order.serviceCode.toLowerCase() === context.serviceCode.toLowerCase();
      const sameServer =
        resolveServerId(order.serverId) === resolveServerId(context.serverId);
      const createdAt = new Date(order.createdAt).getTime();
      const closeInTime =
        Number.isFinite(currentCreatedAt) &&
        Number.isFinite(createdAt) &&
        Math.abs(createdAt - currentCreatedAt) <= 30 * 60 * 1000;

      return samePhone && sameService && sameServer && closeInTime;
    });
    const matchedOrder = directMatch ?? fallbackMatch;

    if (!matchedOrder) {
      return null;
    }

    const providerRef =
      matchedOrder.providerRef ??
      (matchedOrder.id !== context.localOrderId ? matchedOrder.id : undefined);

    if (!providerRef) {
      return null;
    }

    return {
      ...context,
      upstreamOrderId: providerRef,
      providerRef,
      phoneNumber:
        context.phoneNumber && context.phoneNumber !== "-"
          ? context.phoneNumber
          : matchedOrder.phoneNumber,
      otpCode: context.otpCode ?? matchedOrder.otpCode,
      status:
        context.status === "pending" ? matchedOrder.status : context.status,
    } satisfies OrderContext;
  } catch (error) {
    console.error("Gagal mencari providerRef dari history upstream:", error);
    return null;
  }
}

function toOrderContext(order: Order): OrderContext {
  return {
    localOrderId: order.id,
    upstreamOrderId: order.providerRef ?? order.id,
    serviceId: order.serviceId,
    serviceCode: order.serviceCode,
    serverId: order.serverId ?? resolveServerId(order.serverId),
    service: order.service,
    country: order.country,
    countryId: order.countryId ?? defaultCountry.id,
    price: order.price,
    currency: order.currency,
    phoneNumber: order.phoneNumber,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    providerRef: order.providerRef,
    otpCode: order.otpCode,
    status: order.status,
  };
}

async function persistOrder(order: Order) {
  const nextOrder = attachOrderContextToken(order);
  const context = toOrderContext(nextOrder);
  orderContextStore.set(nextOrder.id, context);

  if (nextOrder.providerRef && nextOrder.providerRef !== nextOrder.id) {
    orderContextStore.set(nextOrder.providerRef, context);
  }

  try {
    await saveOrderToDatabase(nextOrder);
  } catch (error) {
    console.error("Gagal menyimpan order ke database:", error);
  }

  return nextOrder;
}

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const config = getProviderConfig();
  const pricing = await getPricingRuntimeStatus();
  const paymentGateway = getPaymentGatewayStatus();

  return {
    providerMode: config.mode,
    upstreamConfigured: Boolean(config.baseUrl && config.apiKey),
    baseUrlHost: getBaseHost(config.baseUrl),
    markupPercent: pricing.markupPercent,
    minMargin: pricing.minMargin,
    currency: pricing.currency,
    midtransConfigured: paymentGateway.midtransConfigured,
    midtransEnvironment: paymentGateway.midtransEnvironment,
    midtransClientKeyAvailable: paymentGateway.midtransClientKeyAvailable,
    paymentDatabaseConfigured: paymentGateway.paymentDatabaseConfigured,
    orderDatabaseConfigured: isOrderDatabaseConfigured(),
  };
}

export async function getCatalog(filters: CatalogFilters = {}) {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    const services = applyFilters(
      listMockServices({
        serverId: resolveServerId(filters.serverId),
        countryId: resolveCountryId(filters.countryId),
      }),
      filters,
    );

    return buildCatalogResponse(services, "mock", { source: "fallback" });
  }

  try {
    const serverId = resolveServerId(filters.serverId);
    const countryId = resolveCountryId(filters.countryId);
    const pricingRules = await getPricingRulesForCatalog(serverId, countryId);
    const cachedServices = applyFilters(
      getCachedCatalog(serverId, countryId).map((service) =>
        applyPricingToService(service, pricingRules),
      ),
      filters,
    );
    const services = (await fetchLiveServices(serverId, countryId)).map((service) =>
      applyPricingToService(service, pricingRules),
    );
    const filteredServices = applyFilters(services, filters);

    if (filteredServices.length === 0 && cachedServices.length > 0) {
      return buildCatalogResponse(cachedServices, "rest", {
        source: "fallback",
        warning:
          "Katalog live KirimKode dari serverless sedang kosong. Menampilkan cache sinkronisasi terbaru dari KirimKode.",
      });
    }

    return buildCatalogResponse(filteredServices, "rest", {
      source: "upstream",
      warning:
        filteredServices.length === 0
          ? "Katalog real KirimKode untuk server dan negara ini sedang kosong."
          : undefined,
    });
  } catch (error) {
    const cachedServices = applyFilters(
      getCachedCatalog(
        resolveServerId(filters.serverId),
        resolveCountryId(filters.countryId),
      ),
      filters,
    );

    if (cachedServices.length > 0) {
      return buildCatalogResponse(cachedServices, "rest", {
        source: "fallback",
        warning:
          "Request live ke KirimKode gagal dari Vercel. Menampilkan cache sinkronisasi terbaru dari KirimKode.",
      });
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : "Gagal memuat katalog real dari KirimKode.",
    );
  }
}

function buildProviderVariantResponse(
  services: Service[],
  mode: RuntimeStatus["providerMode"],
  serviceCode: string,
  serviceName: string,
  extras?: {
    source?: "upstream" | "fallback";
    warning?: string;
  },
): ProviderVariantResponse {
  return {
    updatedAt: new Date().toISOString(),
    mode,
    serviceCode,
    service: serviceName,
    services,
    source: extras?.source,
    warning: extras?.warning,
  };
}

export async function getServiceProviders(filters: {
  serverId: string;
  countryId: number | string;
  serviceCode: string;
}) {
  const config = getProviderConfig();
  const serverId = resolveServerId(filters.serverId);
  const countryId = resolveCountryId(filters.countryId);
  const serviceCode = filters.serviceCode.trim().toLowerCase();

  if (config.mode === "mock") {
    const services = listMockServices({ serverId, countryId }).filter(
      (service) => service.serviceCode.toLowerCase() === serviceCode,
    );

    return buildProviderVariantResponse(
      services,
      "mock",
      serviceCode,
      services[0]?.service ?? formatServiceName(serviceCode),
      { source: "fallback" },
    );
  }

  if (serverId !== "bimasakti") {
    const catalog = await getCatalog({ serverId, countryId });
    const services = catalog.services.filter(
      (service) => service.serviceCode.toLowerCase() === serviceCode,
    );

    return buildProviderVariantResponse(
      services,
      "rest",
      serviceCode,
      services[0]?.service ?? formatServiceName(serviceCode),
      { source: catalog.source, warning: catalog.warning },
    );
  }

  try {
    const country = await getWebCountryMeta(serverId, countryId);
    const payload = await fetchKirimKodeWeb(
      buildPathWithQuery("/api/otp/layanan/providers", {
        negara: countryId,
        code: serviceCode,
      }),
    );
    const record =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    const providerItems = Array.isArray(record.providers)
      ? record.providers
      : [];
    const serviceName = formatServiceName(
      serviceCode,
      pickString(record, ["service"], ""),
    );
    const pricingRules = await getPricingRulesForCatalog(serverId, countryId);
    const services = providerItems
      .map((item): Service | null => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }

        const provider = item as Record<string, unknown>;
        const providerServerId = pickString(provider, ["serverId"], "");
        const upstreamPrice = pickNumber(provider, ["price", "harga"], 0);

        if (!providerServerId || upstreamPrice <= 0) {
          return null;
        }

        const providerCountryId = pickNumber(
          provider,
          ["negaraId", "countryId"],
          countryId,
        );
        const providerServiceCode =
          pickString(provider, ["actualCode", "serviceCode"], "") || serviceCode;
        const providerName = getSkywordProviderDisplayName(
          providerServerId,
          pickString(provider, ["name"], ""),
        );
        const providerIcon = getSkywordProviderDisplayIcon(
          providerServerId,
          pickString(provider, ["icon"], "") || undefined,
        );

        return {
          id: `${serverId}-${country.id}-${serviceCode}-${providerServerId}`,
          slug: `${serverId}-${country.id}-${serviceCode}-${providerServerId}`,
          serverId,
          serviceCode,
          service: serviceName,
          providerServerId,
          providerName,
          providerIcon,
          providerCountryId,
          providerServiceCode,
          country: country.name,
          countryId: country.id,
          countryCode: country.code,
          category: "OTP",
          upstreamPrice,
          price: computeRetailPrice(upstreamPrice),
          stock: pickNumber(provider, ["stock", "stok"], 0),
          currency: getPricingConfig().currency,
          deliveryEtaSeconds: 20,
          tags: ["KirimKode Web", getServerName(serverId), providerName],
        } satisfies Service;
      })
      .filter((service): service is Service => Boolean(service))
      .map((service) => applyPricingToService(service, pricingRules));

    return buildProviderVariantResponse(services, "rest", serviceCode, serviceName, {
      source: "upstream",
      warning:
        services.length === 0
          ? "Provider layanan KirimKode untuk negara ini sedang kosong."
          : undefined,
    });
  } catch (error) {
    const services = listMockServices({ serverId, countryId }).filter(
      (service) => service.serviceCode.toLowerCase() === serviceCode,
    );

    if (services.length > 0) {
      return buildProviderVariantResponse(
        services,
        "rest",
        serviceCode,
        services[0]?.service ?? formatServiceName(serviceCode),
        {
          source: "fallback",
          warning:
            "Request provider KirimKode gagal. Menampilkan cache/fallback sementara.",
        },
      );
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : "Gagal memuat provider layanan KirimKode.",
    );
  }
}

export async function getCountries(serverId?: string): Promise<CountryOption[]> {
  const config = getProviderConfig();
  const resolvedServerId = resolveServerId(serverId);
  const cachedCountries = getCachedCountries(resolvedServerId);

  if (config.mode === "mock") {
    return [
      {
        id: defaultCountry.id,
        name: defaultCountry.name,
        code: defaultCountry.code,
        flagEmoji: undefined,
        availableServices: listMockServices({ serverId: resolvedServerId, countryId: defaultCountry.id }).length,
        serverId: resolvedServerId,
      },
    ];
  }

  const cacheKey = `web-country:${resolveWebServer(resolvedServerId)}`;
  const cached = countryCacheStore.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.countries;
  }

  const countries = await fetchWebCountries(resolvedServerId).catch(() => []);

  if (countries.length === 0 && cachedCountries.length > 0) {
    return cachedCountries;
  }

  countryCacheStore.set(cacheKey, {
    countries,
    expiresAt:
      Date.now() +
      (Number.isFinite(config.countryCacheTtlMs) ? config.countryCacheTtlMs : 1800000),
  });

  return countries.length > 0 ? countries : cachedCountries;
}

export async function getBalance(): Promise<Balance> {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    return getMockBalance();
  }

  const payload = await fetchUpstream(config.balancePath);
  return normalizeBalance(payload);
}

export async function getHistory(): Promise<OrderHistoryResponse> {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    return listMockOrders();
  }

  const payload = await fetchUpstream(config.historyPath);
  return normalizeHistory(payload);
}

export async function createOrder(input: CreateOrderInput) {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    return await persistOrder(
      createMockOrder({
        serviceId: input.serviceId,
        serverId: input.serverId,
        countryId: input.countryId,
      }),
    );
  }

  const fallbackCurrency = input.currency ?? getPricingConfig().currency;
  const payload = await fetchUpstream(config.orderPath, {
    method: config.orderMethod,
    body: {
      server: input.providerServerId ?? resolveUpstreamServer(input.serverId),
      country: input.providerCountryId ?? input.countryId,
      service: input.providerServiceCode ?? input.serviceCode,
      operator: input.operator ?? "any",
    },
  });

  const order = normalizeCreatedOrder(payload, {
    localOrderId: "",
    upstreamOrderId: "",
    serviceId: input.serviceId,
    serviceCode: input.serviceCode,
    serverId: resolveServerId(input.serverId),
    service: input.service,
    country: input.country,
    countryId: input.countryId,
    price: input.price ?? 0,
    currency: fallbackCurrency,
    providerRef: undefined,
    otpCode: undefined,
  });

  return await persistOrder(order);
}

export async function getOrder(orderId: string, contextToken?: string | null) {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    const order = getMockOrder(orderId);
    return order ? await persistOrder(order) : order;
  }

  const resolvedFallback = await (async () => {
    const localFallback = orderContextStore.get(orderId);

    if (localFallback) {
      return localFallback;
    }

    const databaseOrder = await getOrderFromDatabase(orderId).catch((error) => {
      console.error("Gagal membaca order dari database:", error);
      return null;
    });

    if (databaseOrder) {
      const restoredContext = toOrderContext(databaseOrder);
      orderContextStore.set(databaseOrder.id, restoredContext);
      if (databaseOrder.providerRef && databaseOrder.providerRef !== databaseOrder.id) {
        orderContextStore.set(databaseOrder.providerRef, restoredContext);
      }
      return restoredContext;
    }

    const restoredOrder = restoreOrderFromContextToken(orderId, contextToken);

    if (!restoredOrder) {
      return null;
    }

    const restoredContext = toOrderContext(restoredOrder);
    orderContextStore.set(restoredOrder.id, restoredContext);
    if (restoredOrder.providerRef && restoredOrder.providerRef !== restoredOrder.id) {
      orderContextStore.set(restoredOrder.providerRef, restoredContext);
    }
    return restoredContext;
  })();

  if (!resolvedFallback) {
    throw new Error(
      "Context order tidak ditemukan. Pastikan order sudah tersimpan di database atau refresh dari payment terbaru.",
    );
  }

  const hydratedFallback =
    !resolvedFallback.providerRef || resolvedFallback.providerRef === resolvedFallback.localOrderId
      ? await resolveProviderRefFromHistory(resolvedFallback)
      : null;
  const effectiveFallback = hydratedFallback ?? resolvedFallback;

  const orderRequestCandidates = [
    effectiveFallback.upstreamOrderId,
    effectiveFallback.localOrderId,
    orderId,
  ].filter((candidate, index, values) => Boolean(candidate) && values.indexOf(candidate) === index);
  let lastError: unknown = null;
  let payload: unknown = null;

  for (const candidate of orderRequestCandidates) {
    try {
      payload = await fetchUpstream(replaceOrderId(config.orderStatusPath, candidate));
      break;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      const canRetry = /not found|tidak ditemukan|order/i.test(message);

      if (!canRetry) {
        throw error;
      }
    }
  }

  if (!payload) {
    throw (lastError instanceof Error ? lastError : new Error("Gagal membaca status order."));
  }

  const order = normalizeStatusOrder(payload, effectiveFallback);

  return await persistOrder(order);
}

export async function cancelOrder(orderId: string, contextToken?: string | null) {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    const order = cancelMockOrder(orderId);
    return order ? await persistOrder(order) : order;
  }

  const fallback = await (async () => {
    const localFallback = orderContextStore.get(orderId);

    if (localFallback) {
      return localFallback;
    }

    const databaseOrder = await getOrderFromDatabase(orderId).catch((error) => {
      console.error("Gagal membaca order cancel dari database:", error);
      return null;
    });

    if (databaseOrder) {
      const restoredContext = toOrderContext(databaseOrder);
      orderContextStore.set(databaseOrder.id, restoredContext);
      if (databaseOrder.providerRef && databaseOrder.providerRef !== databaseOrder.id) {
        orderContextStore.set(databaseOrder.providerRef, restoredContext);
      }
      return restoredContext;
    }

    const restoredOrder = restoreOrderFromContextToken(orderId, contextToken);

    if (!restoredOrder) {
      return null;
    }

    const restoredContext = toOrderContext(restoredOrder);
    orderContextStore.set(restoredOrder.id, restoredContext);
    if (restoredOrder.providerRef && restoredOrder.providerRef !== restoredOrder.id) {
      orderContextStore.set(restoredOrder.providerRef, restoredContext);
    }
    return restoredContext;
  })();

  if (!fallback) {
    return null;
  }

  const hydratedFallback =
    !fallback.providerRef || fallback.providerRef === fallback.localOrderId
      ? await resolveProviderRefFromHistory(fallback)
      : null;
  const effectiveFallback = hydratedFallback ?? fallback;

  const cancelRequestCandidates = [
    effectiveFallback.upstreamOrderId,
    effectiveFallback.localOrderId,
    orderId,
  ].filter((candidate, index, values) => Boolean(candidate) && values.indexOf(candidate) === index);
  let cancelSucceeded = false;
  let lastCancelError: unknown = null;

  for (const candidate of cancelRequestCandidates) {
    try {
      await fetchUpstream(replaceOrderId(config.cancelPath, candidate), {
        method: config.cancelMethod,
      });
      cancelSucceeded = true;
      break;
    } catch (error) {
      lastCancelError = error;
      const message = error instanceof Error ? error.message : "";
      const canRetry = /not found|tidak ditemukan|order/i.test(message);

      if (!canRetry) {
        throw error;
      }
    }
  }

  if (!cancelSucceeded) {
    throw (lastCancelError instanceof Error ? lastCancelError : new Error("Gagal membatalkan order."));
  }

  const order = {
    id: effectiveFallback.localOrderId,
    serviceId: effectiveFallback.serviceId,
    serviceCode: effectiveFallback.serviceCode,
    serverId: effectiveFallback.serverId,
    service: effectiveFallback.service,
    country: effectiveFallback.country,
    countryId: effectiveFallback.countryId,
    phoneNumber: effectiveFallback.phoneNumber,
    price: effectiveFallback.price,
    currency: effectiveFallback.currency,
    status: "cancelled" as const,
    otpCode: effectiveFallback.otpCode,
    createdAt: effectiveFallback.createdAt,
    expiresAt: effectiveFallback.expiresAt,
    providerRef: effectiveFallback.providerRef,
  } satisfies Order;

  return await persistOrder(order);
}
