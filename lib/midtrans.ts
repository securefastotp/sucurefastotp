import "server-only";

import crypto from "node:crypto";

type MidtransEnvironment = "sandbox" | "production";

type CreateSnapTransactionInput = {
  orderId: string;
  amount: number;
  currency: string;
  serviceId: string;
  serviceName: string;
  country: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  callbackUrl?: string;
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

function getMidtransEnvironment(): MidtransEnvironment {
  return process.env.MIDTRANS_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";
}

export function getMidtransConfig() {
  const environment = getMidtransEnvironment();
  const isProduction = environment === "production";

  return {
    environment,
    serverKey: process.env.MIDTRANS_SERVER_KEY ?? "",
    clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "",
    apiBaseUrl: isProduction
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com",
    snapScriptUrl: isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js",
  };
}

function buildBasicAuth(serverKey: string) {
  return Buffer.from(`${serverKey}:`).toString("base64");
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  if ("status_message" in payload && typeof payload.status_message === "string") {
    return payload.status_message;
  }

  if ("error_messages" in payload && Array.isArray(payload.error_messages)) {
    const message = payload.error_messages.find(
      (item): item is string => typeof item === "string",
    );

    if (message) {
      return message;
    }
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}

async function requestMidtrans(
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
  },
) {
  const config = getMidtransConfig();

  if (!config.serverKey) {
    throw new Error(
      "Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY di Vercel.",
    );
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${buildBasicAuth(config.serverKey)}`,
      "Content-Type": "application/json",
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

export async function createMidtransTransaction(
  input: CreateSnapTransactionInput,
) {
  const payload = await requestMidtrans("/snap/v1/transactions", {
    method: "POST",
    body: {
      transaction_details: {
        order_id: input.orderId,
        gross_amount: Math.max(1, Math.round(input.amount)),
      },
      item_details: [
        {
          id: input.serviceId,
          name: `${input.serviceName} ${input.country}`.slice(0, 50),
          price: Math.max(1, Math.round(input.amount)),
          quantity: 1,
          category: "OTP Service",
        },
      ],
      customer_details: {
        first_name: input.customerName || "OTP Customer",
        email: input.customerEmail || undefined,
        phone: input.customerPhone || undefined,
      },
      callbacks: input.callbackUrl
        ? {
            finish: input.callbackUrl,
            pending: input.callbackUrl,
            error: input.callbackUrl,
          }
        : undefined,
      custom_field1: input.serviceId,
      custom_field2: input.serviceName.slice(0, 255),
      custom_field3: input.country.slice(0, 255),
    },
  });

  return {
    token:
      typeof payload.token === "string" && payload.token
        ? payload.token
        : undefined,
    redirectUrl:
      typeof payload.redirect_url === "string" && payload.redirect_url
        ? payload.redirect_url
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
