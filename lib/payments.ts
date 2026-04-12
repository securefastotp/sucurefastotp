import "server-only";

import crypto from "node:crypto";
import {
  createMidtransTransaction,
  getMidtransConfig,
  getMidtransTransactionStatus,
  normalizeMidtransPaymentStatus,
  verifyMidtransSignature,
} from "@/lib/midtrans";
import { createOrder } from "@/lib/provider";
import { siteConfig } from "@/lib/site-config";
import type { PaymentRecord, RuntimeStatus } from "@/lib/types";

type CreatePaymentInput = {
  serviceId: string;
  service: string;
  country: string;
  price: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
};

const paymentsGlobal = globalThis as typeof globalThis & {
  __otpPaymentStore?: Map<string, PaymentRecord>;
};

const paymentStore =
  paymentsGlobal.__otpPaymentStore ?? new Map<string, PaymentRecord>();
paymentsGlobal.__otpPaymentStore = paymentStore;

function createPaymentId() {
  const random = crypto.randomBytes(3).toString("hex");
  return `pay_${Date.now().toString(36)}${random}`;
}

function getCallbackUrl(paymentId: string) {
  return `${siteConfig.url.replace(/\/$/, "")}/console?payment=${paymentId}`;
}

export function getPaymentGatewayStatus() {
  const config = getMidtransConfig();

  return {
    midtransConfigured: Boolean(config.serverKey && config.clientKey),
    midtransEnvironment: config.environment,
    midtransClientKeyAvailable: Boolean(config.clientKey),
  } satisfies Pick<
    RuntimeStatus,
    "midtransConfigured" | "midtransEnvironment" | "midtransClientKeyAvailable"
  >;
}

function updatePaymentRecord(
  payment: PaymentRecord,
  statusPayload: Record<string, unknown>,
) {
  const nextStatus = normalizeMidtransPaymentStatus(
    typeof statusPayload.transaction_status === "string"
      ? statusPayload.transaction_status
      : undefined,
    typeof statusPayload.fraud_status === "string"
      ? statusPayload.fraud_status
      : undefined,
  );

  payment.status = nextStatus;
  payment.updatedAt = new Date().toISOString();
  payment.statusMessage =
    typeof statusPayload.status_message === "string"
      ? statusPayload.status_message
      : payment.statusMessage;

  if (nextStatus === "paid" && !payment.paidAt) {
    payment.paidAt = new Date().toISOString();
  }

  paymentStore.set(payment.id, payment);
  return payment;
}

export async function createPaymentSession(input: CreatePaymentInput) {
  const config = getMidtransConfig();

  if (!config.serverKey || !config.clientKey) {
    throw new Error(
      "Midtrans belum siap. Isi MIDTRANS_SERVER_KEY dan NEXT_PUBLIC_MIDTRANS_CLIENT_KEY di Vercel.",
    );
  }

  const paymentId = createPaymentId();
  const amount = Math.max(1, Math.round(input.price));
  const now = new Date().toISOString();
  const payment: PaymentRecord = {
    id: paymentId,
    gateway: "midtrans",
    serviceId: input.serviceId,
    service: input.service,
    country: input.country,
    amount,
    currency: input.currency ?? "IDR",
    status: "pending",
    customerName: input.customerName || undefined,
    customerEmail: input.customerEmail || undefined,
    customerPhone: input.customerPhone || undefined,
    midtransOrderId: paymentId,
    createdAt: now,
    updatedAt: now,
    statusMessage: "Checkout Midtrans dibuat. Lanjutkan pembayaran.",
  };

  const transaction = await createMidtransTransaction({
    orderId: paymentId,
    amount,
    currency: payment.currency,
    serviceId: payment.serviceId,
    serviceName: payment.service,
    country: payment.country,
    customerName: payment.customerName,
    customerEmail: payment.customerEmail,
    customerPhone: payment.customerPhone,
    callbackUrl: getCallbackUrl(paymentId),
  });

  payment.snapToken = transaction.token;
  payment.redirectUrl = transaction.redirectUrl;
  paymentStore.set(payment.id, payment);

  return payment;
}

export async function getPaymentSession(paymentId: string) {
  const payment = paymentStore.get(paymentId);

  if (!payment) {
    return null;
  }

  try {
    const statusPayload = await getMidtransTransactionStatus(payment.midtransOrderId);
    return updatePaymentRecord(payment, statusPayload);
  } catch {
    return payment;
  }
}

export async function activatePaymentOrder(paymentId: string) {
  const payment = await getPaymentSession(paymentId);

  if (!payment) {
    return null;
  }

  if (payment.status !== "paid") {
    return payment;
  }

  if (payment.order) {
    return payment;
  }

  payment.order = await createOrder({
    serviceId: payment.serviceId,
    service: payment.service,
    country: payment.country,
    price: payment.amount,
    currency: payment.currency,
  });
  payment.updatedAt = new Date().toISOString();
  payment.statusMessage = "Pembayaran terverifikasi dan order sudah dibuat.";
  paymentStore.set(payment.id, payment);

  return payment;
}

export async function handleMidtransNotification(payload: Record<string, unknown>) {
  const typedPayload = payload as {
    order_id?: string;
    signature_key?: string;
    transaction_status?: string;
    fraud_status?: string;
    status_message?: string;
    status_code?: string;
    gross_amount?: string;
  };

  if (!verifyMidtransSignature(typedPayload)) {
    throw new Error("Signature Midtrans tidak valid.");
  }

  const paymentId = typedPayload.order_id;

  if (!paymentId) {
    throw new Error("Payload Midtrans tidak punya order_id.");
  }

  const payment = paymentStore.get(paymentId);

  if (!payment) {
    return null;
  }

  return updatePaymentRecord(payment, typedPayload);
}
