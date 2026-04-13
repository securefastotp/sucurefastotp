import "server-only";

import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type {
  AuthViewer,
  DepositRecord,
  Order,
  WalletLedgerEntry,
  WalletLedgerKind,
} from "@/lib/types";

type NeonSql = ReturnType<typeof neon>;

type StoredUserRow = {
  user_id: string;
  full_name: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  balance: number;
};

type StoredSessionRow = {
  session_id: string;
  user_id: string;
  expires_at: string;
};

type StoredDepositRow = {
  deposit_id: string;
  data: DepositRecord | string;
};

type StoredOrderRow = {
  order_id: string;
  data: Order | string;
};

type StoredLedgerRow = {
  entry_id: string;
  user_id: string;
  kind: WalletLedgerKind;
  amount: number;
  balance_after: number;
  description: string;
  reference_id: string | null;
  created_at: string;
};

type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
};

const databaseGlobal = globalThis as typeof globalThis & {
  __rahmatOtpAccountSql?: NeonSql | null;
  __rahmatOtpAccountTablesReady?: Promise<boolean>;
};

function getDatabaseUrl() {
  return (
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  );
}

function getSql() {
  if ("__rahmatOtpAccountSql" in databaseGlobal) {
    return databaseGlobal.__rahmatOtpAccountSql ?? null;
  }

  const databaseUrl = getDatabaseUrl();
  databaseGlobal.__rahmatOtpAccountSql = databaseUrl ? neon(databaseUrl) : null;

  return databaseGlobal.__rahmatOtpAccountSql;
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseJsonRecord<T extends object>(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as T;
  }

  return null;
}

async function ensureAccountTables() {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  if (!databaseGlobal.__rahmatOtpAccountTablesReady) {
    databaseGlobal.__rahmatOtpAccountTablesReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_users (
          user_id TEXT PRIMARY KEY,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS app_sessions (
          session_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS app_sessions_user_id_idx
        ON app_sessions (user_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS app_sessions_expires_at_idx
        ON app_sessions (expires_at)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS app_wallets (
          user_id TEXT PRIMARY KEY REFERENCES app_users(user_id) ON DELETE CASCADE,
          balance INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS app_wallet_ledger (
          entry_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          amount INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          description TEXT NOT NULL,
          reference_id TEXT,
          created_at TIMESTAMPTZ NOT NULL,
          data JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS app_wallet_ledger_user_id_idx
        ON app_wallet_ledger (user_id, created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS app_deposits (
          deposit_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          amount INTEGER NOT NULL,
          fee_amount INTEGER NOT NULL,
          total_amount INTEGER NOT NULL,
          currency TEXT NOT NULL,
          midtrans_order_id TEXT NOT NULL UNIQUE,
          transaction_id TEXT,
          qr_code_url TEXT,
          qr_string TEXT,
          status_message TEXT,
          paid_at TIMESTAMPTZ,
          credited_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          data JSONB NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS app_deposits_user_id_idx
        ON app_deposits (user_id, created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS app_deposits_status_idx
        ON app_deposits (status, created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS app_user_orders (
          order_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          data JSONB NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS app_user_orders_user_id_idx
        ON app_user_orders (user_id, created_at DESC)
      `;

      return true;
    })().catch((error) => {
      databaseGlobal.__rahmatOtpAccountTablesReady = undefined;
      throw error;
    });
  }

  return databaseGlobal.__rahmatOtpAccountTablesReady;
}

function toViewer(row: StoredUserRow): AuthViewer {
  return {
    id: row.user_id,
    name: row.full_name,
    email: row.email,
    createdAt: row.created_at,
    walletBalance: row.balance ?? 0,
  };
}

export function isAccountDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

export async function createUser(input: CreateUserInput) {
  const sql = getSql();

  if (!sql) {
    throw new Error("Database akun belum terhubung di Vercel.");
  }

  await ensureAccountTables();

  const userId = createId("usr");
  const now = new Date().toISOString();
  const email = normalizeEmail(input.email);

  try {
    await sql.transaction([
      sql`
        INSERT INTO app_users (
          user_id,
          full_name,
          email,
          password_hash,
          created_at,
          updated_at
        )
        VALUES (
          ${userId},
          ${input.name.trim()},
          ${email},
          ${input.passwordHash},
          ${now},
          ${now}
        )
      `,
      sql`
        INSERT INTO app_wallets (
          user_id,
          balance,
          created_at,
          updated_at
        )
        VALUES (
          ${userId},
          0,
          ${now},
          ${now}
        )
      `,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat akun.";

    if (/duplicate key|unique/i.test(message)) {
      throw new Error("Email sudah terdaftar. Gunakan email lain atau langsung login.");
    }

    throw error;
  }

  const viewer = await getViewerById(userId);

  if (!viewer) {
    throw new Error("Akun berhasil dibuat, tetapi data user tidak bisa dibaca ulang.");
  }

  return viewer;
}

export async function getUserByEmail(email: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAccountTables();

  const rows = (await sql`
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.password_hash,
      u.created_at,
      u.updated_at,
      COALESCE(w.balance, 0) AS balance
    FROM app_users u
    LEFT JOIN app_wallets w ON w.user_id = u.user_id
    WHERE u.email = ${normalizeEmail(email)}
    LIMIT 1
  `) as StoredUserRow[];

  return rows[0] ?? null;
}

export async function getViewerById(userId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAccountTables();

  const rows = (await sql`
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.password_hash,
      u.created_at,
      u.updated_at,
      COALESCE(w.balance, 0) AS balance
    FROM app_users u
    LEFT JOIN app_wallets w ON w.user_id = u.user_id
    WHERE u.user_id = ${userId}
    LIMIT 1
  `) as StoredUserRow[];

  return rows[0] ? toViewer(rows[0]) : null;
}

export async function createSessionRecord(userId: string, expiresAt: string) {
  const sql = getSql();

  if (!sql) {
    throw new Error("Database session belum tersedia.");
  }

  await ensureAccountTables();

  const sessionId = createId("sess");
  const now = new Date().toISOString();

  await sql`
    INSERT INTO app_sessions (
      session_id,
      user_id,
      created_at,
      expires_at
    )
    VALUES (
      ${sessionId},
      ${userId},
      ${now},
      ${expiresAt}
    )
  `;

  return {
    sessionId,
    expiresAt,
  };
}

export async function getSessionRecord(sessionId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAccountTables();

  const rows = (await sql`
    SELECT session_id, user_id, expires_at
    FROM app_sessions
    WHERE session_id = ${sessionId}
    LIMIT 1
  `) as StoredSessionRow[];

  return rows[0] ?? null;
}

export async function deleteSessionRecord(sessionId: string) {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  await ensureAccountTables();

  await sql`
    DELETE FROM app_sessions
    WHERE session_id = ${sessionId}
  `;

  return true;
}

export async function deleteExpiredSessions() {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  await ensureAccountTables();

  await sql`
    DELETE FROM app_sessions
    WHERE expires_at < NOW()
  `;

  return true;
}

export async function createDepositRecord(deposit: DepositRecord) {
  const sql = getSql();

  if (!sql) {
    throw new Error("Database deposit belum tersedia.");
  }

  await ensureAccountTables();

  await sql`
    INSERT INTO app_deposits (
      deposit_id,
      user_id,
      status,
      amount,
      fee_amount,
      total_amount,
      currency,
      midtrans_order_id,
      transaction_id,
      qr_code_url,
      qr_string,
      status_message,
      paid_at,
      credited_at,
      expires_at,
      created_at,
      updated_at,
      data
    )
    VALUES (
      ${deposit.id},
      ${deposit.userId},
      ${deposit.status},
      ${deposit.amount},
      ${deposit.feeAmount},
      ${deposit.totalAmount},
      ${deposit.currency},
      ${deposit.midtransOrderId},
      ${deposit.transactionId ?? null},
      ${deposit.qrCodeUrl ?? null},
      ${deposit.qrString ?? null},
      ${deposit.statusMessage ?? null},
      ${deposit.paidAt ?? null},
      ${deposit.creditedAt ?? null},
      ${deposit.expiresAt ?? null},
      ${deposit.createdAt},
      ${deposit.updatedAt},
      ${JSON.stringify(deposit)}::jsonb
    )
    ON CONFLICT (deposit_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      amount = EXCLUDED.amount,
      fee_amount = EXCLUDED.fee_amount,
      total_amount = EXCLUDED.total_amount,
      currency = EXCLUDED.currency,
      transaction_id = EXCLUDED.transaction_id,
      qr_code_url = EXCLUDED.qr_code_url,
      qr_string = EXCLUDED.qr_string,
      status_message = EXCLUDED.status_message,
      paid_at = EXCLUDED.paid_at,
      credited_at = EXCLUDED.credited_at,
      expires_at = EXCLUDED.expires_at,
      updated_at = EXCLUDED.updated_at,
      data = EXCLUDED.data
  `;

  return true;
}

export async function getDepositById(depositId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAccountTables();

  const rows = (await sql`
    SELECT deposit_id, data
    FROM app_deposits
    WHERE deposit_id = ${depositId}
    LIMIT 1
  `) as StoredDepositRow[];

  return parseJsonRecord<DepositRecord>(rows[0]?.data);
}

export async function getDepositByMidtransOrderId(midtransOrderId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAccountTables();

  const rows = (await sql`
    SELECT deposit_id, data
    FROM app_deposits
    WHERE midtrans_order_id = ${midtransOrderId}
    LIMIT 1
  `) as StoredDepositRow[];

  return parseJsonRecord<DepositRecord>(rows[0]?.data);
}

export async function listDepositsByUser(userId: string, limit = 20) {
  const sql = getSql();

  if (!sql) {
    return [] as DepositRecord[];
  }

  await ensureAccountTables();

  const rows = (await sql`
    SELECT deposit_id, data
    FROM app_deposits
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, limit)}
  `) as StoredDepositRow[];

  return rows
    .map((row) => parseJsonRecord<DepositRecord>(row.data))
    .filter((deposit): deposit is DepositRecord => deposit !== null);
}

export async function createWalletEntry(input: {
  userId: string;
  kind: WalletLedgerKind;
  amount: number;
  description: string;
  referenceId?: string;
  data?: Record<string, unknown>;
}) {
  const sql = getSql();

  if (!sql) {
    throw new Error("Wallet database belum tersedia.");
  }

  await ensureAccountTables();

  const entryId = createId("ldg");
  const now = new Date().toISOString();

  const rows = (await sql`
    WITH updated_wallet AS (
      UPDATE app_wallets
      SET
        balance = balance + ${input.amount},
        updated_at = ${now}
      WHERE
        user_id = ${input.userId}
        AND balance + ${input.amount} >= 0
      RETURNING balance
    ),
    inserted_ledger AS (
      INSERT INTO app_wallet_ledger (
        entry_id,
        user_id,
        kind,
        amount,
        balance_after,
        description,
        reference_id,
        created_at,
        data
      )
      SELECT
        ${entryId},
        ${input.userId},
        ${input.kind},
        ${input.amount},
        balance,
        ${input.description},
        ${input.referenceId ?? null},
        ${now},
        ${JSON.stringify(input.data ?? {})}::jsonb
      FROM updated_wallet
      RETURNING balance_after
    )
    SELECT balance_after
    FROM inserted_ledger
  `) as Array<{ balance_after: number }>;

  if (!rows[0]) {
    throw new Error("Saldo tidak cukup untuk memproses transaksi ini.");
  }

  return rows[0].balance_after;
}

export async function applyDepositCredit(depositId: string) {
  const sql = getSql();

  if (!sql) {
    throw new Error("Wallet database belum tersedia.");
  }

  await ensureAccountTables();

  const entryId = createId("ldg");
  const now = new Date().toISOString();

  const rows = (await sql`
    WITH target_deposit AS (
      SELECT deposit_id, user_id, amount
      FROM app_deposits
      WHERE
        deposit_id = ${depositId}
        AND status = 'paid'
        AND credited_at IS NULL
    ),
    updated_wallet AS (
      UPDATE app_wallets
      SET
        balance = balance + target_deposit.amount,
        updated_at = ${now}
      FROM target_deposit
      WHERE app_wallets.user_id = target_deposit.user_id
      RETURNING app_wallets.user_id, app_wallets.balance, target_deposit.deposit_id, target_deposit.amount
    ),
    inserted_ledger AS (
      INSERT INTO app_wallet_ledger (
        entry_id,
        user_id,
        kind,
        amount,
        balance_after,
        description,
        reference_id,
        created_at,
        data
      )
      SELECT
        ${entryId},
        user_id,
        'deposit_credit',
        amount,
        balance,
        'Deposit saldo via Midtrans',
        deposit_id,
        ${now},
        ${JSON.stringify({ source: "midtrans" })}::jsonb
      FROM updated_wallet
    )
    UPDATE app_deposits
    SET
      credited_at = ${now},
      updated_at = ${now}
    WHERE deposit_id IN (SELECT deposit_id FROM updated_wallet)
    RETURNING deposit_id
  `) as Array<{ deposit_id: string }>;

  return Boolean(rows[0]);
}

export async function listWalletLedger(userId: string, limit = 20) {
  const sql = getSql();

  if (!sql) {
    return [] as WalletLedgerEntry[];
  }

  await ensureAccountTables();

  const rows = (await sql`
    SELECT
      entry_id,
      user_id,
      kind,
      amount,
      balance_after,
      description,
      reference_id,
      created_at
    FROM app_wallet_ledger
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, limit)}
  `) as StoredLedgerRow[];

  return rows.map((row) => ({
    id: row.entry_id,
    userId: row.user_id,
    kind: row.kind,
    amount: row.amount,
    balanceAfter: row.balance_after,
    description: row.description,
    referenceId: row.reference_id ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function upsertUserOrder(userId: string, order: Order) {
  const sql = getSql();

  if (!sql) {
    throw new Error("Database order user belum tersedia.");
  }

  await ensureAccountTables();

  const updatedAt = order.updatedAt ?? new Date().toISOString();
  const nextOrder = {
    ...order,
    updatedAt,
  } satisfies Order;

  await sql`
    INSERT INTO app_user_orders (
      order_id,
      user_id,
      status,
      created_at,
      updated_at,
      data
    )
    VALUES (
      ${order.id},
      ${userId},
      ${order.status},
      ${order.createdAt},
      ${updatedAt},
      ${JSON.stringify(nextOrder)}::jsonb
    )
    ON CONFLICT (order_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at,
      data = EXCLUDED.data
  `;

  return nextOrder;
}

export async function getUserOrder(userId: string, orderId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureAccountTables();

  const rows = (await sql`
    SELECT order_id, data
    FROM app_user_orders
    WHERE user_id = ${userId} AND order_id = ${orderId}
    LIMIT 1
  `) as StoredOrderRow[];

  return parseJsonRecord<Order>(rows[0]?.data);
}

export async function listUserOrders(userId: string, limit = 20) {
  const sql = getSql();

  if (!sql) {
    return [] as Order[];
  }

  await ensureAccountTables();

  const rows = (await sql`
    SELECT order_id, data
    FROM app_user_orders
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, limit)}
  `) as StoredOrderRow[];

  return rows
    .map((row) => parseJsonRecord<Order>(row.data))
    .filter((order): order is Order => order !== null);
}
