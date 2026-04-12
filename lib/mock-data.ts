import { computeRetailPrice } from "@/lib/pricing";
import type { Balance, Order, OrderHistoryResponse, Service } from "@/lib/types";

type RawService = Omit<Service, "price" | "slug" | "currency">;

type StoredMockOrder = Order & {
  pollCount: number;
};

const rawCatalog: RawService[] = [
  {
    id: "wa-id",
    service: "WhatsApp",
    country: "Indonesia",
    countryCode: "ID",
    category: "Sosial",
    upstreamPrice: 1500,
    stock: 342,
    deliveryEtaSeconds: 18,
    tags: ["Hot", "Fast In"],
  },
  {
    id: "tg-id",
    service: "Telegram",
    country: "Indonesia",
    countryCode: "ID",
    category: "Sosial",
    upstreamPrice: 1200,
    stock: 521,
    deliveryEtaSeconds: 15,
    tags: ["Stable", "Mass Order"],
  },
  {
    id: "fb-id",
    service: "Facebook",
    country: "Indonesia",
    countryCode: "ID",
    category: "Sosial",
    upstreamPrice: 2000,
    stock: 189,
    deliveryEtaSeconds: 28,
    tags: ["Verified", "Good Success"],
  },
  {
    id: "ig-id",
    service: "Instagram",
    country: "Indonesia",
    countryCode: "ID",
    category: "Sosial",
    upstreamPrice: 2500,
    stock: 156,
    deliveryEtaSeconds: 30,
    tags: ["Creator", "Safe"],
  },
  {
    id: "tt-id",
    service: "TikTok",
    country: "Indonesia",
    countryCode: "ID",
    category: "Sosial",
    upstreamPrice: 1800,
    stock: 278,
    deliveryEtaSeconds: 24,
    tags: ["Trending", "Volume"],
  },
  {
    id: "dc-id",
    service: "Discord",
    country: "Indonesia",
    countryCode: "ID",
    category: "Komunitas",
    upstreamPrice: 1500,
    stock: 445,
    deliveryEtaSeconds: 20,
    tags: ["Gaming", "Stable"],
  },
  {
    id: "gg-id",
    service: "Google",
    country: "Indonesia",
    countryCode: "ID",
    category: "Produktivitas",
    upstreamPrice: 3000,
    stock: 67,
    deliveryEtaSeconds: 34,
    tags: ["Premium", "Manual Check"],
  },
  {
    id: "sp-id",
    service: "Shopee",
    country: "Indonesia",
    countryCode: "ID",
    category: "Marketplace",
    upstreamPrice: 1200,
    stock: 389,
    deliveryEtaSeconds: 17,
    tags: ["Fast In", "Mass Order"],
  },
  {
    id: "wa-us",
    service: "WhatsApp",
    country: "Amerika Serikat",
    countryCode: "US",
    category: "Sosial",
    upstreamPrice: 5250,
    stock: 120,
    deliveryEtaSeconds: 25,
    tags: ["Premium", "High Trust"],
  },
  {
    id: "tg-us",
    service: "Telegram",
    country: "Amerika Serikat",
    countryCode: "US",
    category: "Sosial",
    upstreamPrice: 4200,
    stock: 98,
    deliveryEtaSeconds: 21,
    tags: ["Premium", "Stable"],
  },
  {
    id: "wa-in",
    service: "WhatsApp",
    country: "India",
    countryCode: "IN",
    category: "Sosial",
    upstreamPrice: 1200,
    stock: 890,
    deliveryEtaSeconds: 12,
    tags: ["Cheapest", "Volume"],
  },
  {
    id: "gg-in",
    service: "Google",
    country: "India",
    countryCode: "IN",
    category: "Produktivitas",
    upstreamPrice: 2200,
    stock: 214,
    deliveryEtaSeconds: 19,
    tags: ["Testing", "Good Success"],
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

export function listMockServices() {
  return rawCatalog.map((service) => ({
    ...service,
    slug: slugify(`${service.service}-${service.country}`),
    price: computeRetailPrice(service.upstreamPrice),
    currency: "IDR",
  }));
}

export function getMockServiceById(serviceId: string) {
  return listMockServices().find((service) => service.id === serviceId) ?? null;
}

export function createMockOrder(serviceId: string) {
  const service = getMockServiceById(serviceId);

  if (!service) {
    throw new Error("Service mock tidak ditemukan.");
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 20 * 60 * 1000);

  const order: StoredMockOrder = {
    id: `order_${Math.random().toString(36).slice(2, 10)}`,
    serviceId: service.id,
    service: service.service,
    country: service.country,
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
    service: stored.service,
    country: stored.country,
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
    service: stored.service,
    country: stored.country,
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
      service: stored.service,
      country: stored.country,
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
