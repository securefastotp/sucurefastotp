import { computeRetailPrice } from "@/lib/pricing";
import type { Balance, Order, OrderHistoryResponse, Service } from "@/lib/types";

type RawService = {
  serviceCode: string;
  service: string;
  category: string;
  upstreamPrice: number;
  stock: number;
  deliveryEtaSeconds: number;
  tags: string[];
};

type StoredMockOrder = Order & {
  pollCount: number;
};

const defaultCountry = {
  id: 6,
  name: "Indonesia",
  code: "ID",
};

const rawCatalog: RawService[] = [
  {
    serviceCode: "wa",
    service: "WhatsApp",
    category: "Sosial",
    upstreamPrice: 1500,
    stock: 342,
    deliveryEtaSeconds: 18,
    tags: ["Hot", "Fast In"],
  },
  {
    serviceCode: "tg",
    service: "Telegram",
    category: "Sosial",
    upstreamPrice: 1200,
    stock: 521,
    deliveryEtaSeconds: 15,
    tags: ["Stable", "Mass Order"],
  },
  {
    serviceCode: "fb",
    service: "Facebook",
    category: "Sosial",
    upstreamPrice: 2000,
    stock: 189,
    deliveryEtaSeconds: 28,
    tags: ["Verified", "Good Success"],
  },
  {
    serviceCode: "ig",
    service: "Instagram",
    category: "Sosial",
    upstreamPrice: 2500,
    stock: 156,
    deliveryEtaSeconds: 30,
    tags: ["Creator", "Safe"],
  },
  {
    serviceCode: "tt",
    service: "TikTok",
    category: "Sosial",
    upstreamPrice: 1800,
    stock: 278,
    deliveryEtaSeconds: 24,
    tags: ["Trending", "Volume"],
  },
  {
    serviceCode: "dc",
    service: "Discord",
    category: "Komunitas",
    upstreamPrice: 1500,
    stock: 445,
    deliveryEtaSeconds: 20,
    tags: ["Gaming", "Stable"],
  },
  {
    serviceCode: "gg",
    service: "Google",
    category: "Produktivitas",
    upstreamPrice: 3000,
    stock: 67,
    deliveryEtaSeconds: 34,
    tags: ["Premium", "Manual Check"],
  },
  {
    serviceCode: "sp",
    service: "Shopee",
    category: "Marketplace",
    upstreamPrice: 1200,
    stock: 389,
    deliveryEtaSeconds: 17,
    tags: ["Fast In", "Mass Order"],
  },
];

const globalStore = globalThis as typeof globalThis & {
  __mockOtpOrders?: Map<string, StoredMockOrder>;
};

const mockOrderStore =
  globalStore.__mockOtpOrders ?? new Map<string, StoredMockOrder>();
globalStore.__mockOtpOrders = mockOrderStore;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function randomDigits(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

function getServerMeta(serverId: string) {
  if (serverId === "mars") {
    return {
      id: "mars" as const,
      stockRatio: 0.78,
    };
  }

  return {
    id: "bimasakti" as const,
    stockRatio: 1,
  };
}

export function listMockServices(filters?: {
  serverId?: string;
  countryId?: number;
}) {
  const serverMeta = getServerMeta(filters?.serverId ?? "bimasakti");
  const providerVariants =
    serverMeta.id === "bimasakti"
      ? [
          {
            code: "api1",
            name: "Senja",
            icon: "S",
            stockRatio: 1,
            priceRatio: 1,
          },
          {
            code: "api3",
            name: "Zynn",
            icon: "Z",
            stockRatio: 0.58,
            priceRatio: 1.32,
          },
        ]
      : [
          {
            code: "api1",
            name: "Blueverifiy",
            icon: undefined,
            stockRatio: serverMeta.stockRatio,
            priceRatio: 1,
          },
        ];

  return rawCatalog.flatMap((service) =>
    providerVariants.map((provider) => {
      const stock = Math.max(0, Math.round(service.stock * provider.stockRatio));
      const upstreamPrice = Math.round(service.upstreamPrice * provider.priceRatio);

      return {
        id: `${serverMeta.id}-${defaultCountry.id}-${service.serviceCode}-${provider.code}`,
        slug: slugify(`${service.service}-${defaultCountry.name}-${serverMeta.id}-${provider.code}`),
        serverId: serverMeta.id,
        serviceCode: service.serviceCode,
        service: service.service,
        providerServerId: provider.code,
        providerName: provider.name,
        providerIcon: provider.icon,
        providerCountryId: filters?.countryId ?? defaultCountry.id,
        providerServiceCode: service.serviceCode,
        country: defaultCountry.name,
        countryId: filters?.countryId ?? defaultCountry.id,
        countryCode: defaultCountry.code,
        category: service.category,
        upstreamPrice,
        price: computeRetailPrice(upstreamPrice),
        stock,
        currency: "IDR",
        deliveryEtaSeconds: service.deliveryEtaSeconds,
        tags: [...service.tags, provider.name],
      } satisfies Service;
    }),
  );
}

export function getMockServiceById(
  serviceId: string,
  filters?: {
    serverId?: string;
    countryId?: number;
  },
) {
  return (
    listMockServices(filters).find((service) => service.id === serviceId) ?? null
  );
}

export function createMockOrder(input: {
  serviceId: string;
  serverId: string;
  countryId: number;
}) {
  const service = getMockServiceById(input.serviceId, {
    serverId: input.serverId,
    countryId: input.countryId,
  });

  if (!service) {
    throw new Error("Service mock tidak ditemukan.");
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 20 * 60 * 1000);

  const order: StoredMockOrder = {
    id: `order_${Math.random().toString(36).slice(2, 10)}`,
    serviceId: service.id,
    serviceCode: service.serviceCode,
    serverId: service.serverId,
    service: service.service,
    country: service.country,
    countryId: service.countryId,
    phoneNumber: `+62${randomDigits(10)}`,
    price: service.price,
    currency: service.currency,
    status: "pending",
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    providerRef: `MOCK-${randomDigits(5)}`,
    pollCount: 0,
  };

  mockOrderStore.set(order.id, order);

  return { ...order };
}

export function getMockOrder(orderId: string): Order | null {
  const stored = mockOrderStore.get(orderId);

  if (!stored) {
    return null;
  }

  if (stored.status === "pending") {
    stored.pollCount += 1;

    if (Date.now() > new Date(stored.expiresAt).getTime()) {
      stored.status = "expired";
    } else if (stored.pollCount >= 2) {
      stored.status = "otp_received";
      stored.otpCode = randomDigits(6);
    }
  }

  mockOrderStore.set(orderId, stored);

  return {
    id: stored.id,
    serviceId: stored.serviceId,
    serviceCode: stored.serviceCode,
    serverId: stored.serverId,
    service: stored.service,
    country: stored.country,
    countryId: stored.countryId,
    phoneNumber: stored.phoneNumber,
    price: stored.price,
    currency: stored.currency,
    status: stored.status,
    otpCode: stored.otpCode,
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
    providerRef: stored.providerRef,
  };
}

export function cancelMockOrder(orderId: string): Order | null {
  const stored = mockOrderStore.get(orderId);

  if (!stored) {
    return null;
  }

  stored.status = "cancelled";
  mockOrderStore.set(orderId, stored);

  return {
    id: stored.id,
    serviceId: stored.serviceId,
    serviceCode: stored.serviceCode,
    serverId: stored.serverId,
    service: stored.service,
    country: stored.country,
    countryId: stored.countryId,
    phoneNumber: stored.phoneNumber,
    price: stored.price,
    currency: stored.currency,
    status: stored.status,
    otpCode: stored.otpCode,
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
    providerRef: stored.providerRef,
  };
}

export function getMockBalance(): Balance {
  return {
    amount: 275000,
    currency: "IDR",
    updatedAt: new Date().toISOString(),
    mode: "mock",
  };
}

export function listMockOrders(): OrderHistoryResponse {
  const orders = [...mockOrderStore.values()]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .map((stored) => ({
      id: stored.id,
      serviceId: stored.serviceId,
      serviceCode: stored.serviceCode,
      serverId: stored.serverId,
      service: stored.service,
      country: stored.country,
      countryId: stored.countryId,
      phoneNumber: stored.phoneNumber,
      price: stored.price,
      currency: stored.currency,
      status: stored.status,
      otpCode: stored.otpCode,
      createdAt: stored.createdAt,
      expiresAt: stored.expiresAt,
      providerRef: stored.providerRef,
    }));

  return {
    updatedAt: new Date().toISOString(),
    mode: "mock",
    total: orders.length,
    orders,
  };
}
