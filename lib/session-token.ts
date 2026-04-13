import "server-only";

import crypto from "node:crypto";
import type { Order } from "@/lib/types";

type SessionEnvelope<T> = {
  kind: string;
  payload: T;
};

type SerializableOrder = Omit<Order, "contextToken">;

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSessionTokenSecret() {
  const configuredSecret =
    process.env.PAYMENT_SESSION_SECRET?.trim() ||
    process.env.MIDTRANS_SERVER_KEY?.trim() ||
    process.env.UPSTREAM_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "rahmat-otp-local-secret";

  return crypto
    .createHash("sha256")
    .update(configuredSecret)
    .digest();
}

function signPayload(value: string) {
  return crypto
    .createHmac("sha256", getSessionTokenSecret())
    .update(value)
    .digest("base64url");
}

export function signSessionToken<T>(kind: string, payload: T) {
  const encodedPayload = toBase64Url(
    JSON.stringify({
      kind,
      payload,
    } satisfies SessionEnvelope<T>),
  );
  const signature = signPayload(`${kind}.${encodedPayload}`);

  return `${encodedPayload}.${signature}`;
}

export function readSessionToken<T>(kind: string, token?: string | null) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(`${kind}.${encodedPayload}`);
  const providedSignature = Buffer.from(signature, "utf8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    providedSignature.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as SessionEnvelope<T>;

    if (!parsed || parsed.kind !== kind) {
      return null;
    }

    return parsed.payload;
  } catch {
    return null;
  }
}

function serializeOrder(order: Order): SerializableOrder {
  const { contextToken, ...snapshot } = order;
  void contextToken;

  return snapshot;
}

export function attachOrderContextToken(order: Order): Order {
  const snapshot = serializeOrder(order);

  return {
    ...snapshot,
    contextToken: signSessionToken("order", snapshot),
  };
}

export function restoreOrderFromContextToken(orderId: string, token?: string | null) {
  const payload = readSessionToken<SerializableOrder>("order", token);

  if (!payload || payload.id !== orderId) {
    return null;
  }

  return attachOrderContextToken(payload);
}
