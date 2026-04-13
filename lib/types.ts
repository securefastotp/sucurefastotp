export type ProviderMode = "mock" | "rest";

export type Service = {
  id: string;
  slug: string;
  serverId: string;
  serviceCode: string;
  service: string;
  country: string;
  countryId: number;
  countryCode: string;
  category: string;
  upstreamPrice: number;
  price: number;
  stock: number;
  currency: string;
  deliveryEtaSeconds: number;
  tags: string[];
};

export type CountryOption = {
  id: number;
  name: string;
  code: string;
  flagEmoji?: string;
  availableServices: number;
  serverId: string;
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
  serviceCode: string;
  serverId?: string;
  service: string;
  country: string;
  countryId?: number;
  phoneNumber: string;
  price: number;
  currency: string;
  status: OrderStatus;
  otpCode?: string;
  createdAt: string;
  expiresAt: string;
  providerRef?: string;
  contextToken?: string;
};

export type RuntimeStatus = {
  providerMode: ProviderMode;
  upstreamConfigured: boolean;
  baseUrlHost: string | null;
  markupPercent: number;
  minMargin: number;
  currency: string;
  midtransConfigured: boolean;
  midtransEnvironment: "sandbox" | "production";
  midtransClientKeyAvailable: boolean;
  paymentDatabaseConfigured: boolean;
  orderDatabaseConfigured: boolean;
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

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

export type PaymentRecord = {
  id: string;
  gateway: "midtrans";
  paymentMethod: "qris";
  serviceId: string;
  serviceCode: string;
  serverId: string;
  operator: string;
  service: string;
  country: string;
  countryId: number;
  subtotalAmount: number;
  feeAmount: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  qrCodeUrl?: string;
  qrString?: string;
  expiresAt?: string;
  transactionId?: string;
  midtransOrderId: string;
  statusMessage?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  order?: Order;
  sessionToken?: string;
};
