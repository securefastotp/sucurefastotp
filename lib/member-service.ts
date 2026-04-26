import "server-only";

import crypto from "node:crypto";
import {
  applyDepositCredit,
  createDepositRecord,
  createWalletEntry,
  getConfiguredAdminEmail,
  getDepositById,
  getDepositByMidtransOrderId,
  getUserOrder,
  hasWalletLedgerReference,
  getViewerById,
  deleteUserAccount,
  setUserBlocked,
  updateUserAccount,
  listAdminUsers,
  listDepositsByUser,
  listUserOrders,
  listWalletLedger,
  upsertUserOrder,
} from "@/lib/account-store";
import {
  createMidtransQrisTransaction,
  getMidtransTransactionStatus,
  normalizeMidtransPaymentStatus,
  verifyMidtransSignature,
} from "@/lib/midtrans";
import {
  isOperatorAllowedForCountry,
  normalizeOperatorForCountry,
} from "@/lib/operators";
import { hashPasswordForStorage } from "@/lib/auth";
import { cancelOrder, createOrder, getBalance, getCatalog, getOrder, getServiceProviders } from "@/lib/provider";
import { siteConfig } from "@/lib/site-config";
import type { DashboardSummary, DepositRecord, Order } from "@/lib/types";

type CreateDepositInput = {
  userId: string;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
};

type PurchaseOrderInput = {
  userId: string;
  serviceId: string;
  serviceCode?: string;
  serverId: "bimasakti" | "mars";
  countryId: number;
  providerServerId?: string;
  providerCountryId?: number;
  providerServiceCode?: string;
  operator?: string;
};

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`;
}

function getNotificationUrl() {
  return `${siteConfig.url.replace(/\/$/, "")}/api/account/deposits/notify`;
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

function isAdminViewer(viewer: { role: string; email: string }) {
  const adminEmail = getConfiguredAdminEmail();
  if (!adminEmail) {
    return viewer.role === "admin";
  }

  return viewer.email.trim().toLowerCase() === adminEmail;
}

async function saveDepositRecord(deposit: DepositRecord) {
  await createDepositRecord(deposit);
  return deposit;
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const viewer = await getViewerById(userId);

  if (!viewer) {
    throw new Error("Akun user tidak ditemukan.");
  }

  const [deposits, orders, ledger, upstreamBalanceResult] = await Promise.all([
    listDepositsByUser(userId, 10),
    listUserOrders(userId, 20),
    listWalletLedger(userId, 5),
    isAdminViewer(viewer)
      ? getBalance()
          .then((balance) => ({ balance, error: null }))
          .catch((error) => ({
            balance: null,
            error:
              error instanceof Error
                ? error.message
                : "Gagal membaca saldo KirimKode.",
          }))
      : Promise.resolve({ balance: null, error: null }),
  ]);

  return {
    viewer,
    metrics: {
      totalOrders: orders.length,
      successfulOtps: orders.filter((order) => order.status === "otp_received").length,
      pendingOrders: orders.filter((order) => order.status === "pending").length,
      totalDeposits: deposits
        .filter((deposit) => deposit.status === "paid")
        .reduce((sum, deposit) => sum + deposit.amount, 0),
    },
    admin:
      isAdminViewer(viewer)
        ? {
            upstreamBalance: upstreamBalanceResult.balance,
            upstreamBalanceError: upstreamBalanceResult.error,
          }
        : null,
    deposits,
    orders,
    ledger,
  };
}

export async function createDepositSession(input: CreateDepositInput) {
  const subtotalAmount = Math.max(1000, Math.round(input.amount));
  const feeAmount = computeBuyerFee(subtotalAmount);
  const totalAmount = subtotalAmount + feeAmount;
  const { expiryMinutes } = getQrisFeeConfig();
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + Math.max(1, expiryMinutes) * 60 * 1000,
  ).toISOString();
  const depositId = createId("dep");

  const transaction = await createMidtransQrisTransaction({
    orderId: depositId,
    amount: totalAmount,
    subtotalAmount,
    feeAmount,
    currency: "IDR",
    serviceId: "wallet-deposit",
    serviceName: "Deposit Saldo",
    country: "Rahmat OTP",
    customerName: input.customerName || "Rahmat OTP User",
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    notificationUrl: getNotificationUrl(),
    expiresAt,
  });

  const deposit: DepositRecord = {
    id: depositId,
    userId: input.userId,
    amount: subtotalAmount,
    feeAmount,
    totalAmount,
    currency: "IDR",
    status: "pending",
    qrCodeUrl: transaction.qrCodeUrl,
    qrString: transaction.qrString,
    expiresAt,
    transactionId: transaction.transactionId,
    midtransOrderId: depositId,
    statusMessage: "QRIS deposit siap dibayar. Setelah lunas, saldo akun otomatis masuk.",
    createdAt: now,
    updatedAt: now,
  };

  return await saveDepositRecord(deposit);
}

export async function syncDepositStatus(userId: string, depositId: string) {
  const deposit = await getDepositById(depositId);

  if (!deposit || deposit.userId !== userId) {
    return null;
  }

  const statusPayload = await getMidtransTransactionStatus(deposit.midtransOrderId);
  const nextStatus = normalizeMidtransPaymentStatus(
    typeof statusPayload.transaction_status === "string"
      ? statusPayload.transaction_status
      : undefined,
    typeof statusPayload.fraud_status === "string"
      ? statusPayload.fraud_status
      : undefined,
  );

  const nextDeposit: DepositRecord = {
    ...deposit,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    transactionId:
      typeof statusPayload.transaction_id === "string"
        ? statusPayload.transaction_id
        : deposit.transactionId,
    statusMessage:
      typeof statusPayload.status_message === "string"
        ? statusPayload.status_message
        : deposit.statusMessage,
    paidAt:
      nextStatus === "paid" && !deposit.paidAt
        ? new Date().toISOString()
        : deposit.paidAt,
  };

  await saveDepositRecord(nextDeposit);

  if (nextDeposit.status === "paid" && !nextDeposit.creditedAt) {
    const credited = await applyDepositCredit(nextDeposit.id);

    if (credited) {
      nextDeposit.creditedAt = new Date().toISOString();
      nextDeposit.updatedAt = nextDeposit.creditedAt;
      await saveDepositRecord(nextDeposit);
    }
  }

  return nextDeposit;
}

export async function handleDepositNotification(payload: Record<string, unknown>) {
  const typedPayload = payload as {
    order_id?: string;
    signature_key?: string;
    transaction_status?: string;
    fraud_status?: string;
    status_message?: string;
    transaction_id?: string;
  };

  if (!verifyMidtransSignature(typedPayload)) {
    throw new Error("Signature Midtrans tidak valid.");
  }

  if (!typedPayload.order_id) {
    throw new Error("Payload Midtrans tidak punya order_id.");
  }

  const deposit = await getDepositByMidtransOrderId(typedPayload.order_id);

  if (!deposit) {
    return null;
  }

  const nextStatus = normalizeMidtransPaymentStatus(
    typedPayload.transaction_status,
    typedPayload.fraud_status,
  );
  const nextDeposit: DepositRecord = {
    ...deposit,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    transactionId: typedPayload.transaction_id || deposit.transactionId,
    statusMessage: typedPayload.status_message || deposit.statusMessage,
    paidAt:
      nextStatus === "paid" && !deposit.paidAt
        ? new Date().toISOString()
        : deposit.paidAt,
  };

  await saveDepositRecord(nextDeposit);

  if (nextDeposit.status === "paid" && !nextDeposit.creditedAt) {
    const credited = await applyDepositCredit(nextDeposit.id);

    if (credited) {
      nextDeposit.creditedAt = new Date().toISOString();
      nextDeposit.updatedAt = nextDeposit.creditedAt;
      await saveDepositRecord(nextDeposit);
    }
  }

  return nextDeposit;
}

function getOrderDebitDescription(order: {
  service: string;
  country: string;
}) {
  return `Beli OTP ${order.service} ${order.country}`;
}

function getOrderRefundDescription(order: {
  service: string;
  country: string;
}) {
  return `Refund order OTP ${order.service} ${order.country}`;
}

function getOrderCancelRefundReference(orderId: string) {
  return `cancel:${orderId}`;
}

function normalizeUpstreamOrderErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Gagal membuat order OTP.";
  const normalized = rawMessage.toLowerCase();

  if (
    /(out of stock|sold out|no stock|insufficient stock|stok\s*(habis|kosong))/i.test(
      normalized,
    )
  ) {
    return "Stok layanan habis. Silakan pilih layanan lain.";
  }

  return rawMessage;
}

export async function purchaseOtpWithWallet(input: PurchaseOrderInput) {
  const catalog = await getCatalog({
    serverId: input.serverId,
    countryId: input.countryId,
  });
  let service = catalog.services.find(
    (item) =>
      item.id === input.serviceId ||
      (input.serviceCode ? item.serviceCode === input.serviceCode : false),
  );

  if (input.providerServerId && input.serviceCode) {
    const providers = await getServiceProviders({
      serverId: input.serverId,
      countryId: input.countryId,
      serviceCode: input.serviceCode,
    });
    service =
      providers.services.find(
        (item) =>
          item.id === input.serviceId ||
          (item.providerServerId === input.providerServerId &&
            (!input.providerCountryId || item.providerCountryId === input.providerCountryId) &&
            (!input.providerServiceCode ||
              item.providerServiceCode === input.providerServiceCode)),
      ) ?? service;
  }

  if (!service) {
    throw new Error("Layanan OTP tidak ditemukan atau sudah berubah.");
  }

  if (!Number.isFinite(service.stock) || service.stock <= 0) {
    throw new Error("Stok layanan habis. Silakan pilih layanan lain.");
  }

  if (!isOperatorAllowedForCountry(service.countryId, input.operator)) {
    throw new Error("Operator Indonesia hanya bisa dipakai untuk region Indonesia.");
  }

  const operator = normalizeOperatorForCountry(service.countryId, input.operator);

  const purchaseReferenceId = createId("ordpay");

  await createWalletEntry({
    userId: input.userId,
    kind: "order_debit",
    amount: -service.price,
    description: getOrderDebitDescription(service),
    referenceId: purchaseReferenceId,
    data: {
      serviceId: service.id,
      serviceCode: service.serviceCode,
      serverId: service.serverId,
      providerServerId: service.providerServerId,
      providerName: service.providerName,
      providerCountryId: service.providerCountryId,
      providerServiceCode: service.providerServiceCode,
      countryId: service.countryId,
      price: service.price,
    },
  });

  try {
    const order = await createOrder({
      serviceId: service.id,
      serviceCode: service.serviceCode,
      serverId: service.serverId,
      providerServerId: service.providerServerId,
      providerCountryId: service.providerCountryId,
      providerServiceCode: service.providerServiceCode,
      service: service.service,
      country: service.country,
      countryId: service.countryId,
      operator,
      price: service.price,
      currency: service.currency,
    });

    const nextOrder: Order = {
      ...order,
      updatedAt: new Date().toISOString(),
    };

    await upsertUserOrder(input.userId, nextOrder);

    return nextOrder;
  } catch (error) {
    const normalizedMessage = normalizeUpstreamOrderErrorMessage(error);
    await createWalletEntry({
      userId: input.userId,
      kind: "order_refund",
      amount: service.price,
      description: getOrderRefundDescription(service),
      referenceId: purchaseReferenceId,
      data: {
        serviceId: service.id,
        reason: normalizedMessage,
      },
    }).catch(() => false);

    throw new Error(normalizedMessage);
  }
}

export async function syncUserOrder(userId: string, orderId: string) {
  const currentOrder = await getUserOrder(userId, orderId);

  if (!currentOrder) {
    return null;
  }

  let latestOrder: Order | null = null;

  try {
    latestOrder = await getOrder(
      currentOrder.providerRef ?? orderId,
      currentOrder.contextToken,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const createdAt = new Date(currentOrder.createdAt).getTime();
    const ageMs = Number.isFinite(createdAt) ? Date.now() - createdAt : Infinity;

    if (/not found|tidak ditemukan|order/i.test(message) && ageMs < 2 * 60 * 1000) {
      return currentOrder;
    }

    throw error;
  }

  if (!latestOrder) {
    return null;
  }

  return await upsertUserOrder(userId, {
    ...latestOrder,
    updatedAt: new Date().toISOString(),
  });
}

export async function cancelUserOrder(userId: string, orderId: string) {
  const currentOrder = await getUserOrder(userId, orderId);

  if (!currentOrder) {
    return null;
  }

  if (currentOrder.status !== "pending") {
    throw new Error("Order OTP ini sudah tidak bisa dibatalkan lagi.");
  }

  const cancelledOrder = await cancelOrder(orderId, currentOrder.contextToken);

  if (!cancelledOrder) {
    throw new Error("Order OTP tidak ditemukan di provider.");
  }

  const nextOrder = await upsertUserOrder(userId, {
    ...cancelledOrder,
    updatedAt: new Date().toISOString(),
  });

  const refundReferenceId = getOrderCancelRefundReference(orderId);
  const refundExists = await hasWalletLedgerReference(
    userId,
    refundReferenceId,
    "order_refund",
  );

  if (!refundExists) {
    await createWalletEntry({
      userId,
      kind: "order_refund",
      amount: currentOrder.price,
      description: getOrderRefundDescription(currentOrder),
      referenceId: refundReferenceId,
      data: {
        orderId,
        reason: "cancelled_by_user",
      },
    });
  }

  return nextOrder;
}

export async function getAdminUserList(search = "") {
  return await listAdminUsers(search, 40);
}

export async function applyAdminWalletAdjustment(input: {
  actorUserId: string;
  targetUserId: string;
  amount: number;
  description?: string;
}) {
  const actor = await getViewerById(input.actorUserId);

  if (!actor || !isAdminViewer(actor)) {
    throw new Error("Akses admin ditolak.");
  }

  const targetUser = await getViewerById(input.targetUserId);

  if (!targetUser) {
    throw new Error("User tujuan tidak ditemukan.");
  }

  const amount = Math.trunc(input.amount);

  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error("Nominal penyesuaian saldo wajib diisi.");
  }

  const kind = amount > 0 ? "manual_credit" : "manual_debit";
  const description =
    input.description?.trim() ||
    (amount > 0 ? "Top up manual admin" : "Potong saldo manual admin");

  await createWalletEntry({
    userId: targetUser.id,
    kind,
    amount,
    description,
    referenceId: `admin:${actor.id}`,
    data: {
      actorUserId: actor.id,
      actorEmail: actor.email,
    },
  });

  const nextViewer = await getViewerById(targetUser.id);

  if (!nextViewer) {
    throw new Error("Saldo berhasil diubah, tetapi user tidak bisa dimuat ulang.");
  }

  return nextViewer;
}

export async function applyAdminPasswordReset(input: {
  actorUserId: string;
  targetUserId: string;
  newPassword: string;
}) {
  const actor = await getViewerById(input.actorUserId);

  if (!actor || !isAdminViewer(actor)) {
    throw new Error("Akses admin ditolak.");
  }

  const targetUser = await getViewerById(input.targetUserId);

  if (!targetUser) {
    throw new Error("User tujuan tidak ditemukan.");
  }

  const nextPassword = input.newPassword.trim();

  if (nextPassword.length < 6) {
    throw new Error("Password baru minimal 6 karakter.");
  }

  return await updateUserAccount(targetUser.id, {
    name: targetUser.name,
    email: targetUser.email,
    passwordHash: hashPasswordForStorage(nextPassword),
  });
}

export async function applyAdminBlockUser(input: {
  actorUserId: string;
  targetUserId: string;
  blocked: boolean;
}) {
  const actor = await getViewerById(input.actorUserId);

  if (!actor || !isAdminViewer(actor)) {
    throw new Error("Akses admin ditolak.");
  }

  if (actor.id === input.targetUserId) {
    throw new Error("Admin tidak bisa memblokir akun sendiri.");
  }

  return await setUserBlocked(input.targetUserId, input.blocked);
}

export async function applyAdminDeleteUser(input: {
  actorUserId: string;
  targetUserId: string;
}) {
  const actor = await getViewerById(input.actorUserId);

  if (!actor || !isAdminViewer(actor)) {
    throw new Error("Akses admin ditolak.");
  }

  if (actor.id === input.targetUserId) {
    throw new Error("Admin tidak bisa menghapus akun sendiri.");
  }

  const targetUser = await getViewerById(input.targetUserId);

  if (!targetUser) {
    throw new Error("User tujuan tidak ditemukan.");
  }

  const configuredAdminEmail = getConfiguredAdminEmail();

  if (configuredAdminEmail && targetUser.email === configuredAdminEmail) {
    throw new Error("Akun admin utama tidak boleh dihapus.");
  }

  const deleted = await deleteUserAccount(input.targetUserId);

  if (!deleted) {
    throw new Error("Gagal menghapus user.");
  }

  return true;
}
