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
import { computeRetailPrice, getPricingConfig } from "@/lib/pricing";
import { attachOrderContextToken, restoreOrderFromContextToken } from "@/lib/session-token";
import type {
  Balance,
  CatalogResponse,
  CountryOption,
  Order,
  OrderHistoryResponse,
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
  operator?: string;
  price?: number;
  currency?: string;
};

type OrderContext = {
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
        availableServices: number;
        serverId: string;
      }>;
      catalogs: Record<string, Service[]>;
    }
  >;
};

const defaultCountry = {
  id: 6,
  name: "Indonesia",
  code: "ID",
  flagEmoji: "🇮🇩",
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
    name: "Indonesia",
    code: "ID",
    flagEmoji: "🇮🇩",
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

function getProviderConfig() {
  const apiKey = process.env.UPSTREAM_API_KEY;
  const requestedMode = process.env.UPSTREAM_PROVIDER_MODE;
  const mode =
    requestedMode === "rest" || (!requestedMode && apiKey) ? "rest" : "mock";
  const baseUrl = process.env.UPSTREAM_BASE_URL ?? "https://api.kirimkode.com/v1";

  return {
    mode: mode === "rest" && baseUrl && apiKey ? "rest" : "mock",
    baseUrl,
    apiKey,
    apiKeyHeader: process.env.UPSTREAM_API_KEY_HEADER ?? "x-api-key",
    balancePath: process.env.UPSTREAM_BALANCE_PATH ?? "/balance",
    servicesPath: process.env.UPSTREAM_SERVICES_PATH ?? "/services",
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
    bimasaktiCode: process.env.UPSTREAM_SERVER_BIMASAKTI_CODE ?? "api1",
    marsCode: process.env.UPSTREAM_SERVER_MARS_CODE ?? "api2",
    countryScanIds:
      process.env.UPSTREAM_COUNTRY_SCAN_IDS ??
      "1,3,4,5,6,7,8,9,10,11,13,14,15,16,18,21,25,31,32,34,35,36,37,39,40,61",
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

  if (serverId === "api1" || serverId === "api2") {
    return serverId;
  }

  return resolveServerId(serverId) === "mars"
    ? config.marsCode
    : config.bimasaktiCode;
}

function getServerName(serverId?: string) {
  return resolveServerId(serverId) === "mars" ? "Blueverifiy" : "Skyword";
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
  6: { name: "Indonesia", code: "ID" },
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
};

function getCountryMeta(countryId?: number | string) {
  const resolvedId = resolveCountryId(countryId);

  const knownMeta = countryHintMap[resolvedId] ?? countryMetaMap[resolvedId];

  if (knownMeta) {
    return {
      id: resolvedId,
      name: knownMeta.name,
      code: knownMeta.code,
      flagEmoji: undefined,
    };
  }

  return {
    id: resolvedId,
    name: `Country ID ${resolvedId}`,
    code: "",
    flagEmoji: undefined,
  };
}

function getCountryScanIds() {
  const raw = getProviderConfig().countryScanIds;
  const parsed = raw
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);

  return parsed.length > 0 ? parsed : [defaultCountry.id];
}

function getCachedCountries(serverId: string): CountryOption[] {
  const serverCache = upstreamCache.servers[resolveServerId(serverId)];

  if (!serverCache) {
    return [];
  }

  return serverCache.countries.map((country) => {
    const meta = getCountryMeta(country.id);

    return {
      ...country,
      name:
        country.name && !country.name.toLowerCase().startsWith("country ")
          ? country.name
          : meta.name,
      code: country.code && /^[a-z]{2}$/i.test(country.code) ? country.code : meta.code,
      flagEmoji: meta.flagEmoji,
    };
  });
}

function getCachedCatalog(serverId: string, countryId: number) {
  const serverCache = upstreamCache.servers[resolveServerId(serverId)];

  if (!serverCache) {
    return [];
  }

  return ((serverCache.catalogs[String(countryId)] ?? []) as Service[]).map((service) =>
    normalizeCachedService(service, {
      serverId,
      countryId,
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
  },
) {
  const countryMeta = getCountryMeta(context.countryId);
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
    country: countryMeta.name,
    countryId: countryMeta.id,
    countryCode: countryMeta.code,
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

function normalizeService(
  item: unknown,
  context: {
    serverId: string;
    countryId: number;
  },
): Service | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const record = item as Record<string, unknown>;
  const serviceCode = pickString(record, ["code", "service"], "");
  const upstreamPrice = pickNumber(record, ["price"], 0);

  if (!serviceCode || upstreamPrice <= 0) {
    return null;
  }

  const countryMeta = getCountryMeta(context.countryId);
  const serviceName = formatServiceName(
    serviceCode,
    pickString(record, ["name"], ""),
  );

  return {
    id: `${context.serverId}-${countryMeta.id}-${serviceCode}`,
    slug: `${context.serverId}-${countryMeta.id}-${serviceCode}`,
    serverId: context.serverId,
    serviceCode,
    service: serviceName,
    country: countryMeta.name,
    countryId: countryMeta.id,
    countryCode: countryMeta.code,
    category: "OTP",
    upstreamPrice,
    price: computeRetailPrice(upstreamPrice),
    stock: pickNumber(record, ["stock"], 0),
    currency: getPricingConfig().currency,
    deliveryEtaSeconds: 20,
    tags: ["Live API", getServerName(context.serverId)],
  };
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

  const url = new URL(path, config.baseUrl);
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

async function fetchServicesPayload(serverId: string, countryId?: number) {
  const config = getProviderConfig();
  const path = buildPathWithQuery(config.servicesPath, {
    server: resolveUpstreamServer(serverId),
    country: countryId,
  });

  let payload = await fetchUpstream(path);
  let items = extractArray(payload);

  if (items.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    payload = await fetchUpstream(path);
    items = extractArray(payload);
  }

  return payload;
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
  const price = pickNumber(record, ["price"], fallback.price);
  const providerRef =
    pickString(record, ["id"], "") && pickString(record, ["id"], "") !== orderId
      ? pickString(record, ["id"], "")
      : undefined;

  return {
    id: orderId,
    serviceId: fallback.serviceId,
    serviceCode: fallback.serviceCode,
    serverId: fallback.serverId,
    service: fallback.service,
    country: fallback.country,
    countryId: fallback.countryId,
    phoneNumber,
    price,
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
  orderId: string,
) {
  const record = extractRecord(payload);
  const otpCode = pickString(record, ["code"], "") || undefined;
  let status = normalizeStatus(
    pickString(record, ["status"], context.status),
    Boolean(otpCode),
  );

  if (
    status === "pending" &&
    Date.now() > new Date(context.expiresAt).getTime()
  ) {
    status = "expired";
  }

  return {
    id:
      pickString(record, ["order_id", "id", "orderId"], "") ||
      orderId ||
      context.providerRef ||
      "",
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
    providerRef: context.providerRef,
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
      const timestamp = extractTimestamp(payload, new Date().toISOString());

      return {
        id: orderId || pickString(record, ["id"], ""),
        serviceId: serviceCode,
        serviceCode,
        service: formatServiceName(serviceCode),
        country: defaultCountry.name,
        countryId: defaultCountry.id,
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

function toOrderContext(order: Order): OrderContext {
  return {
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

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const config = getProviderConfig();
  const pricing = getPricingConfig();
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
    const cachedServices = applyFilters(
      getCachedCatalog(serverId, countryId),
      filters,
    );
    const payload = await fetchServicesPayload(serverId, countryId);
    const services = extractArray(payload)
      .map((item) => normalizeService(item, { serverId, countryId }))
      .filter((service): service is Service => Boolean(service));
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

  const cacheKey = resolvedServerId;
  const cached = countryCacheStore.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.countries;
  }

  const ids = getCountryScanIds();
  const results = await Promise.all(
    ids.map(async (countryId): Promise<CountryOption | null> => {
      try {
        const payload = await fetchServicesPayload(resolvedServerId, countryId);
        const items = extractArray(payload);

        if (items.length === 0) {
          return null;
        }

        const meta = getCountryMeta(countryId);

        return {
          id: countryId,
          name: meta.name,
          code: meta.code,
          flagEmoji: meta.flagEmoji,
          availableServices: items.length,
          serverId: resolvedServerId,
        } satisfies CountryOption;
      } catch {
        return null;
      }
    }),
  );

  const countries = results
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      if (left.id === defaultCountry.id) {
        return -1;
      }

      if (right.id === defaultCountry.id) {
        return 1;
      }

      return left.id - right.id;
    });

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
    return attachOrderContextToken(
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
      server: resolveUpstreamServer(input.serverId),
      country: input.countryId,
      service: input.serviceCode,
      operator: input.operator ?? "any",
    },
  });

  const order = normalizeCreatedOrder(payload, {
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

  orderContextStore.set(order.id, toOrderContext(order));
  return attachOrderContextToken(order);
}

export async function getOrder(orderId: string, contextToken?: string | null) {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    const order = getMockOrder(orderId);
    return order ? attachOrderContextToken(order) : order;
  }

  const fallback =
    orderContextStore.get(orderId) ??
    (() => {
      const restoredOrder = restoreOrderFromContextToken(orderId, contextToken);

      if (!restoredOrder) {
        return null;
      }

      const restoredContext = toOrderContext(restoredOrder);
      orderContextStore.set(orderId, restoredContext);
      return restoredContext;
    })();

  if (!fallback) {
    throw new Error(
      "Context order tidak ditemukan. Untuk production, simpan order ke database agar polling OTP tetap stabil.",
    );
  }

  const payload = await fetchUpstream(replaceOrderId(config.orderStatusPath, orderId));
  const order = attachOrderContextToken(
    normalizeStatusOrder(payload, fallback, orderId),
  );
  orderContextStore.set(orderId, toOrderContext(order));

  return order;
}

export async function cancelOrder(orderId: string, contextToken?: string | null) {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    const order = cancelMockOrder(orderId);
    return order ? attachOrderContextToken(order) : order;
  }

  const fallback =
    orderContextStore.get(orderId) ??
    (() => {
      const restoredOrder = restoreOrderFromContextToken(orderId, contextToken);

      if (!restoredOrder) {
        return null;
      }

      const restoredContext = toOrderContext(restoredOrder);
      orderContextStore.set(orderId, restoredContext);
      return restoredContext;
    })();

  if (!fallback) {
    return null;
  }

  await fetchUpstream(replaceOrderId(config.cancelPath, orderId), {
    method: config.cancelMethod,
  });

  const order = attachOrderContextToken({
    id: orderId,
    serviceId: fallback.serviceId,
    serviceCode: fallback.serviceCode,
    serverId: fallback.serverId,
    service: fallback.service,
    country: fallback.country,
    countryId: fallback.countryId,
    phoneNumber: fallback.phoneNumber,
    price: fallback.price,
    currency: fallback.currency,
    status: "cancelled" as const,
    otpCode: fallback.otpCode,
    createdAt: fallback.createdAt,
    expiresAt: fallback.expiresAt,
    providerRef: fallback.providerRef,
  } satisfies Order);

  orderContextStore.set(orderId, toOrderContext(order));
  return order;
}
