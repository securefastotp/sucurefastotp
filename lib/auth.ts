import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import {
  createSessionRecord,
  createUser,
  deleteExpiredSessions,
  deleteSessionRecord,
  getSessionRecord,
  getUserByEmail,
  getViewerById,
} from "@/lib/account-store";
import { readSessionToken, signSessionToken } from "@/lib/session-token";
import { siteConfig } from "@/lib/site-config";
import type { AuthViewer } from "@/lib/types";

const AUTH_COOKIE_NAME = "rahmat_otp_auth";
const SESSION_TTL_DAYS = 30;

type AuthTokenPayload = {
  sessionId: string;
  userId: string;
  expiresAt: string;
};

function createPasswordHash(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

function verifyPasswordHash(password: string, storedValue: string) {
  const [algorithm, salt, hash] = storedValue.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const nextHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const storedBuffer = Buffer.from(hash, "hex");
  const nextBuffer = Buffer.from(nextHash, "hex");

  if (storedBuffer.length !== nextBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, nextBuffer);
}

async function writeAuthCookie(payload: AuthTokenPayload) {
  const cookieStore = await cookies();
  const token = signSessionToken("auth", payload);
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: siteConfig.url.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: new Date(payload.expiresAt),
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: siteConfig.url.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

async function startSession(userId: string) {
  await deleteExpiredSessions().catch(() => false);
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const session = await createSessionRecord(userId, expiresAt);

  await writeAuthCookie({
    sessionId: session.sessionId,
    userId,
    expiresAt,
  });
}

export async function getCurrentViewer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const payload = readSessionToken<AuthTokenPayload>("auth", token);

  if (!payload) {
    return null;
  }

  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    await clearAuthCookie();
    await deleteSessionRecord(payload.sessionId).catch(() => false);
    return null;
  }

  const session = await getSessionRecord(payload.sessionId);

  if (!session || session.user_id !== payload.userId) {
    await clearAuthCookie();
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await clearAuthCookie();
    await deleteSessionRecord(payload.sessionId).catch(() => false);
    return null;
  }

  return await getViewerById(payload.userId);
}

export async function requireCurrentViewer() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    throw new Error("Silakan login dulu untuk melanjutkan.");
  }

  return viewer;
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
}) {
  const name = input.name.trim();
  const email = input.email.trim();
  const password = input.password.trim();

  if (name.length < 3) {
    throw new Error("Nama minimal 3 karakter.");
  }

  if (!email.includes("@")) {
    throw new Error("Format email belum valid.");
  }

  if (password.length < 6) {
    throw new Error("Password minimal 6 karakter.");
  }

  const viewer = await createUser({
    name,
    email,
    passwordHash: createPasswordHash(password),
  });

  await startSession(viewer.id);

  return viewer;
}

export async function loginAccount(input: {
  email: string;
  password: string;
}) {
  const email = input.email.trim();
  const password = input.password.trim();
  const user = await getUserByEmail(email);

  if (!user || !verifyPasswordHash(password, user.password_hash)) {
    throw new Error("Email atau password tidak cocok.");
  }

  const viewer = await getViewerById(user.user_id);

  if (!viewer) {
    throw new Error("Akun ditemukan, tetapi datanya gagal dimuat.");
  }

  await startSession(viewer.id);

  return viewer;
}

export async function logoutAccount() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const payload = readSessionToken<AuthTokenPayload>("auth", token);

  if (payload?.sessionId) {
    await deleteSessionRecord(payload.sessionId).catch(() => false);
  }

  await clearAuthCookie();

  return true;
}

export async function getAuthState(): Promise<{
  viewer: AuthViewer | null;
}> {
  return {
    viewer: await getCurrentViewer(),
  };
}
