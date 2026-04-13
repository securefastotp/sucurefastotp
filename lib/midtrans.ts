import "server-only";

import crypto from "node:crypto";

type MidtransEnvironment = "sandbox" | "production";

type CreateSnapTransactionInput = {
  orderId: string;
  amount: number;
  subtotalAmount: number;
  feeAmount: number;
  currency: string;
  serviceId: string;
  serviceName: string;
  country: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notificationUrl?: string;
  expiresAt?: string;
};

type MidtransTransactionStatus = {
  order_id?: string;
  transaction_status?: string;
  fraud_status?: string;
  gross_amount?: string;
  signature_key?: string;
  status_code?: string;
  status_message?: string;
};

function normalizeEnvValue(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}

function getMidtransEnvironment(): MidtransEnvironment {
  return normalizeEnvValue(process.env.MIDTRANS_ENVIRONMENT).toLowerCase() ===
    "production"
    ? "production"
    : "sandbox";
}

export function getMidtransConfig() {
  const environment = getMidtransEnvironment();
  const isProduction = environment === "production";

  return {
    environment,
    serverKey: normalizeEnvValue(process.env.MIDTRANS_SERVER_KEY),
    clientKey: normalizeEnvValue(process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY),
    apiBaseUrl: isProduction
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com",
    snapScriptUrl: isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js",
  };
}

function getMidtransConfigIssue(config: ReturnType<typeof getMidtransConfig>) {
  if (config.environment === "production") {
    if (
      /^SB-Mid-server-/i.test(config.serverKey) ||
      /^SB-Mid-client-/i.test(config.clientKey)
    ) {
      return "MIDTRANS_ENVIRONMENT=production tetapi key yang dipakai masih sandbox. Gunakan Mid-server- dan Mid-client- production dari merchant yang sama.";
    }

    if (config.serverKey && !/^Mid-server-/i.test(config.serverKey)) {
      return "Format MIDTRANS_SERVER_KEY tidak sesuai. Untuk production gunakan key yang diawali Mid-server-.";
    }

    if (config.clientKey && !/^Mid-client-/i.test(config.clientKey)) {
      return "Format NEXT_PUBLIC_MIDTRANS_CLIENT_KEY tidak sesuai. Untuk production gunakan key yang diawali Mid-client-.";
    }
  }

  if (config.environment === "sandbox") {
    if (
      /^Mid-server-/i.test(config.serverKey) ||
      /^Mid-client-/i.test(config.clientKey)
    ) {
      return "MIDTRANS_ENVIRONMENT=sandbox tetapi key yang dipakai terlihat production. Gunakan SB-Mid-server- dan SB-Mid-client-.";
    }
  }

  return null;
}

function buildBasicAuth(serverKey: string) {
  return Buffer.from(`${serverKey}:`).toString("base64");
}

function getErrorMessage(payload: unknown, fallback: string) {
  const normalizeMessage = (message: string) => {
    if (/unauthorized transaction/i.test(message)) {
      return "Midtrans menolak kredensial checkout. Pastikan MIDTRANS_SERVER_KEY dan NEXT_PUBLIC_MIDTRANS_CLIENT_KEY production di Vercel berasal dari akun merchant yang sama.";
    }

    return message;
  };

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  if ("status_message" in payload && typeof payload.status_message === "string") {
    return normalizeMessage(payload.status_message);
  }

  if ("error_messages" in payload && Array.isArray(payload.error_messages)) {
    const message = payload.error_messages.find(
      (item): item is string => typeof item === "string",
    );

    if (message) {
      return normalizeMessage(message);
    }
  }

  if ("message" in payload && typeof payload.message === "string") {
    return normalizeMessage(payload.message);
  }

  return fallback;
}

async function requestMidtrans(
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    headers?: Record<string, string | undefined>;
  },
) {
  const config = getMidtransConfig();

  if (!config.serverKey) {
    throw new Error(
      "Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY di Vercel.",
    );
  }

  const configIssue = getMidtransConfigIssue(config);

  if (configIssue) {
    throw new Error(configIssue);
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${buildBasicAuth(config.serverKey)}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload, `Midtrans merespons HTTP ${response.status}.`),
    );
  }

  return payload ?? {};
}

function toMidtransTimestamp(value: string) {
  const date = new Date(value);
  const jakartaTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const year = jakartaTime.getUTCFullYear();
  const month = String(jakartaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jakartaTime.getUTCDate()).padStart(2, "0");
  const hours = String(jakartaTime.getUTCHours()).padStart(2, "0");
  const minutes = String(jakartaTime.getUTCMinutes()).padStart(2, "0");
  const seconds = String(jakartaTime.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0700`;
}

export async function createMidtransQrisTransaction(
  input: CreateSnapTransactionInput,
) {
  const payload = await requestMidtrans("/v2/charge", {
    method: "POST",
    headers: input.notificationUrl
      ? {
          "X-Override-Notification": input.notificationUrl,
        }
      : undefined,
    body: {
      payment_type: "qris",
      transaction_details: {
        order_id: input.orderId,
        gross_amount: Math.max(1, Math.round(input.amount)),
      },
      item_details: [
        {
          id: input.serviceId,
          name: `${input.serviceName} ${input.country}`.slice(0, 50),
          price: Math.max(1, Math.round(input.subtotalAmount)),
          quantity: 1,
          category: "OTP Service",
        },
        ...(input.feeAmount > 0
          ? [
              {
                id: "midtrans-fee",
                name: "Biaya Transaksi",
                price: Math.round(input.feeAmount),
                quantity: 1,
                category: "Service Fee",
              },
            ]
          : []),
      ],
      customer_details: {
        first_name: input.customerName || "OTP Customer",
        email: input.customerEmail || undefined,
        phone: input.customerPhone || undefined,
      },
      custom_expiry: input.expiresAt
        ? {
            order_time: toMidtransTimestamp(new Date().toISOString()),
            expiry_duration: Math.max(
              1,
              Math.round(
                (new Date(input.expiresAt).getTime() - Date.now()) / 60000,
              ),
            ),
            unit: "minute",
          }
        : undefined,
      custom_field1: input.serviceId,
      custom_field2: input.serviceName.slice(0, 255),
      custom_field3: input.country.slice(0, 255),
    },
  });

  const actions = Array.isArray(payload.actions)
    ? (payload.actions as Array<Record<string, unknown>>)
    : [];
  const qrAction = actions.find(
    (action) =>
      typeof action.name === "string" &&
      action.name.toLowerCase() === "generate-qr-code",
  );

  return {
    transactionId:
      typeof payload.transaction_id === "string" && payload.transaction_id
        ? payload.transaction_id
        : undefined,
    qrCodeUrl:
      qrAction && typeof qrAction.url === "string" && qrAction.url
        ? qrAction.url
        : undefined,
    qrString:
      typeof payload.qr_string === "string" && payload.qr_string
        ? payload.qr_string
        : undefined,
  };
}

export async function getMidtransTransactionStatus(orderId: string) {
  const payload = await requestMidtrans(`/v2/${encodeURIComponent(orderId)}/status`);

  return payload as MidtransTransactionStatus & Record<string, unknown>;
}

export function normalizeMidtransPaymentStatus(
  status: string | undefined,
  fraudStatus?: string | undefined,
) {
  const normalizedStatus = status?.toLowerCase() ?? "pending";
  const normalizedFraudStatus = fraudStatus?.toLowerCase() ?? "";

  if (
    normalizedStatus === "settlement" ||
    (normalizedStatus === "capture" &&
      ["accept", ""].includes(normalizedFraudStatus))
  ) {
    return "paid" as const;
  }

  if (normalizedStatus === "pending") {
    return "pending" as const;
  }

  if (normalizedStatus === "expire") {
    return "expired" as const;
  }

  if (["cancel", "refund", "partial_refund"].includes(normalizedStatus)) {
    return "cancelled" as const;
  }

  return "failed" as const;
}

export function verifyMidtransSignature(payload: MidtransTransactionStatus) {
  const config = getMidtransConfig();

  if (!config.serverKey || !payload.signature_key) {
    return false;
  }

  const raw = `${payload.order_id ?? ""}${payload.status_code ?? ""}${payload.gross_amount ?? ""}${config.serverKey}`;
  const hash = crypto.createHash("sha512").update(raw).digest("hex");

  return hash === payload.signature_key;
}
