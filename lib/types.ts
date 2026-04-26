export type ProviderMode = "mock" | "rest";

export type Service = {
  id: string;
  slug: string;
  serverId: string;
  serviceCode: string;
  service: string;
  providerServerId?: string;
  providerName?: string;
  providerIcon?: string;
  providerCountryId?: number;
  providerServiceCode?: string;
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

export type ProviderVariantResponse = {
  updatedAt: string;
  mode: ProviderMode;
  serviceCode: string;
  service: string;
  services: Service[];
  source?: "upstream" | "fallback";
  warning?: string;
};

export type ProviderOption = {
  id: string;
  serverId: string;
  providerServerId: string;
  name: string;
  icon?: string;
  country: string;
  countryId: number;
  countryCode: string;
  providerCountryId: number;
  availableServices: number;
  totalStock: number;
  minPrice: number;
  currency: string;
};

export type ProviderOptionsResponse = {
  updatedAt: string;
  mode: ProviderMode;
  serverId: string;
  countryId: number;
  country: string;
  providers: ProviderOption[];
  source?: "upstream" | "fallback";
  warning?: string;
};

export type OperatorOption = {
  id: string;
  label: string;
  serverId: string;
  countryId: number;
  upstreamServerId: string;
  upstreamCountryId: number;
};

export type OperatorOptionsResponse = {
  updatedAt: string;
  mode: ProviderMode;
  serverId: string;
  countryId: number;
  country: string;
  upstreamServerId: string;
  upstreamCountryId: number;
  operators: OperatorOption[];
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
  updatedAt?: string;
};

export type PricingSettings = {
  profitPercent: number;
  minMargin: number;
  currency: string;
  updatedAt?: string | null;
};

export type ServicePriceOverride = {
  serviceId: string;
  serviceCode: string;
  service: string;
  serverId: string;
  countryId: number;
  country: string;
  customPrice: number;
  upstreamPrice: number;
  updatedAt: string;
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

export type UserRole = "member" | "admin";

export type AuthViewer = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isBlocked: boolean;
  createdAt: string;
  walletBalance: number;
};

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isBlocked: boolean;
  createdAt: string;
  walletBalance: number;
};

export type WalletLedgerKind =
  | "deposit_credit"
  | "order_debit"
  | "order_refund"
  | "manual_credit"
  | "manual_debit";

export type WalletLedgerEntry = {
  id: string;
  userId: string;
  kind: WalletLedgerKind;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  createdAt: string;
};

export type DepositStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

export type DepositRecord = {
  id: string;
  userId: string;
  amount: number;
  feeAmount: number;
  totalAmount: number;
  currency: string;
  status: DepositStatus;
  qrCodeUrl?: string;
  qrString?: string;
  expiresAt?: string;
  transactionId?: string;
  midtransOrderId: string;
  statusMessage?: string;
  paidAt?: string;
  creditedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardSummary = {
  viewer: AuthViewer;
  metrics: {
    totalOrders: number;
    successfulOtps: number;
    pendingOrders: number;
    totalDeposits: number;
  };
  admin: {
    upstreamBalance: Balance | null;
    upstreamBalanceError?: string | null;
  } | null;
  deposits: DepositRecord[];
  orders: Order[];
  ledger: WalletLedgerEntry[];
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
  providerServerId?: string;
  providerName?: string;
  providerCountryId?: number;
  providerServiceCode?: string;
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
