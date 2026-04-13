import "server-only";

import { neon } from "@neondatabase/serverless";
import type { PaymentRecord } from "@/lib/types";

type StoredPaymentRow = {
  payment_id: string;
  data: PaymentRecord | string;
};

type NeonSql = ReturnType<typeof neon>;

const databaseGlobal = globalThis as typeof globalThis & {
  __rahmatOtpSql?: NeonSql | null;
  __rahmatOtpPaymentsTableReady?: Promise<boolean>;
};

function getDatabaseUrl() {
  return (
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  );
}

function getSql() {
  if ("__rahmatOtpSql" in databaseGlobal) {
    return databaseGlobal.__rahmatOtpSql ?? null;
  }

  const databaseUrl = getDatabaseUrl();
  databaseGlobal.__rahmatOtpSql = databaseUrl ? neon(databaseUrl) : null;

  return databaseGlobal.__rahmatOtpSql;
}

function parsePaymentRecord(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as PaymentRecord;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value) && "id" in value) {
    return value as PaymentRecord;
  }

  return null;
}

async function ensurePaymentsTable() {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  if (!databaseGlobal.__rahmatOtpPaymentsTableReady) {
    databaseGlobal.__rahmatOtpPaymentsTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS otp_transactions (
          payment_id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          data JSONB NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS otp_transactions_created_at_idx
        ON otp_transactions (created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS otp_transactions_updated_at_idx
        ON otp_transactions (updated_at DESC)
      `;

      return true;
    })().catch((error) => {
      databaseGlobal.__rahmatOtpPaymentsTableReady = undefined;
      throw error;
    });
  }

  return databaseGlobal.__rahmatOtpPaymentsTableReady;
}

export function isPaymentDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

export async function savePaymentToDatabase(payment: PaymentRecord) {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  await ensurePaymentsTable();

  await sql`
    INSERT INTO otp_transactions (
      payment_id,
      status,
      created_at,
      updated_at,
      data
    )
    VALUES (
      ${payment.id},
      ${payment.status},
      ${payment.createdAt},
      ${payment.updatedAt},
      ${JSON.stringify(payment)}::jsonb
    )
    ON CONFLICT (payment_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at,
      data = EXCLUDED.data
  `;

  return true;
}

export async function getPaymentFromDatabase(paymentId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensurePaymentsTable();

  const rows = (await sql`
    SELECT payment_id, data
    FROM otp_transactions
    WHERE payment_id = ${paymentId}
    LIMIT 1
  `) as StoredPaymentRow[];

  return parsePaymentRecord(rows[0]?.data);
}

export async function listPaymentsFromDatabase(limit = 20) {
  const sql = getSql();

  if (!sql) {
    return [] as PaymentRecord[];
  }

  await ensurePaymentsTable();

  const rows = (await sql`
    SELECT payment_id, data
    FROM otp_transactions
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, limit)}
  `) as StoredPaymentRow[];

  return rows
    .map((row) => parsePaymentRecord(row.data))
    .filter((payment): payment is PaymentRecord => payment !== null);
}
