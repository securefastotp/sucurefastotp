export type ProviderMode = "mock" | "rest";

export type Service = {
  id: string;
  slug: string;
  service: string;
  country: string;
  countryCode: string;
  category: string;
  upstreamPrice: number;
  price: number;
  stock: number;
  currency: string;
  deliveryEtaSeconds: number;
  tags: string[];
};

export type CatalogResponse = {
  updatedAt: string;
  mode: ProviderMode;
  total: number;
  countries: string[];
  categories: string[];
  services: Service[];
  source?: "upstream" | "fallback";
  warning?: string;
};

export type OrderStatus = "pending" | "otp_received" | "expired" | "cancelled";

export type Order = {
  id: string;
  serviceId: string;
  service: string;
  country: string;
  phoneNumber: string;
  price: number;
  currency: string;
  status: OrderStatus;
  otpCode?: string;
  createdAt: string;
  expiresAt: string;
  providerRef?: string;
};

export type RuntimeStatus = {
  providerMode: ProviderMode;
  upstreamConfigured: boolean;
  baseUrlHost: string | null;
  markupPercent: number;
  minMargin: number;
  currency: string;
};

export type Balance = {
  amount: number;
  currency: string;
  updatedAt: string;
  mode: ProviderMode;
};

export type OrderHistoryResponse = {
  updatedAt: string;
  mode: ProviderMode;
  total: number;
  orders: Order[];
};
