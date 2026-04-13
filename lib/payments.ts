import "server-only";

import crypto from "node:crypto";
import {
  createMidtransQrisTransaction,
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
  serviceCode: string;
  serverId: string;
  operator?: string;
  service: string;
  country: string;
  countryId: number;
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

function getNotificationUrl() {
  return `${siteConfig.url.replace(/\/$/, "")}/api/payments/notify`;
}

function getQrisFeeConfig() {
  const feePercent = Number(process.env.MIDTRANS_QRIS_FEE_PERCENT ?? 0.7);
  const flatFee = Number(process.env.MIDTRANS_QRIS_FEE_FLAT ?? 0);
  const expiryMinutes = Number(process.env.MIDTRANS_QRIS_EXPIRY_MINUTES ?? 15);

  return {
    feePercent: Number.isFinite(feePercent) ? feePercent : 0.7,
    flatFee: Number.isFinite(flatFee) ? flatFee : 0,
    expiryMinutes: Number.isFinite(expiryMinutes) ? expiryMinutes : 15,
  };
}

function computeBuyerFee(subtotalAmount: number) {
  const { feePercent, flatFee } = getQrisFeeConfig();
  const percentageFee = Math.ceil(Math.max(0, subtotalAmount) * (feePercent / 100));
  return Math.max(0, percentageFee + Math.max(0, Math.round(flatFee)));
}

export function getPaymentGatewayStatus() {
  const config = getMidtransConfig();

  return {
    midtransConfigured: Boolean(config.serverKey),
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
    payment.statusMessage =
      "Pembayaran QRIS berhasil. Menyiapkan nomor OTP dari KirimKode.";
  }

  if (nextStatus === "pending" && !payment.statusMessage) {
    payment.statusMessage =
      "Menunggu pembayaran QRIS. Scan kode lalu cek status beberapa detik lagi.";
  }

  paymentStore.set(payment.id, payment);
  return payment;
}

export async function createPaymentSession(input: CreatePaymentInput) {
  const config = getMidtransConfig();

  if (!config.serverKey) {
    throw new Error(
      "Midtrans belum siap. Isi MIDTRANS_SERVER_KEY di Vercel.",
    );
  }

  const paymentId = createPaymentId();
  const subtotalAmount = Math.max(1, Math.round(input.price));
  const feeAmount = computeBuyerFee(subtotalAmount);
  const amount = subtotalAmount + feeAmount;
  const { expiryMinutes } = getQrisFeeConfig();
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + Math.max(1, expiryMinutes) * 60 * 1000,
  ).toISOString();
  const payment: PaymentRecord = {
    id: paymentId,
    gateway: "midtrans",
    paymentMethod: "qris",
    serviceId: input.serviceId,
    serviceCode: input.serviceCode,
    serverId: input.serverId,
    operator: input.operator ?? "any",
    service: input.service,
    country: input.country,
    countryId: input.countryId,
    subtotalAmount,
    feeAmount,
    amount,
    currency: input.currency ?? "IDR",
    status: "pending",
    customerName: input.customerName || undefined,
    customerEmail: input.customerEmail || undefined,
    customerPhone: input.customerPhone || undefined,
    midtransOrderId: paymentId,
    createdAt: now,
    updatedAt: now,
    expiresAt,
    statusMessage: "QRIS siap dibayar. Scan kode di bawah lalu tunggu verifikasi otomatis.",
  };

  const transaction = await createMidtransQrisTransaction({
    orderId: paymentId,
    amount,
    subtotalAmount,
    feeAmount,
    currency: payment.currency,
    serviceId: payment.serviceId,
    serviceName: payment.service,
    country: payment.country,
    customerName: payment.customerName,
    customerEmail: payment.customerEmail,
    customerPhone: payment.customerPhone,
    notificationUrl: getNotificationUrl(),
    expiresAt,
  });

  payment.transactionId = transaction.transactionId;
  payment.qrCodeUrl = transaction.qrCodeUrl;
  payment.qrString = transaction.qrString;
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
    serviceCode: payment.serviceCode,
    serverId: payment.serverId,
    service: payment.service,
    country: payment.country,
    countryId: payment.countryId,
    operator: payment.operator,
    price: payment.subtotalAmount,
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

export function listPaymentSessions(limit = 20) {
  return [...paymentStore.values()]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, limit);
}
