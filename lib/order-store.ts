import "server-only";

import { neon } from "@neondatabase/serverless";
import { attachOrderContextToken } from "@/lib/session-token";
import type { Order } from "@/lib/types";

type StoredOrderRow = {
  order_id: string;
  data: Order | string;
};

type NeonSql = ReturnType<typeof neon>;

const databaseGlobal = globalThis as typeof globalThis & {
  __rahmatOtpOrderSql?: NeonSql | null;
  __rahmatOtpOrdersTableReady?: Promise<boolean>;
};

function getDatabaseUrl() {
  return (
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  );
}

function getSql() {
  if ("__rahmatOtpOrderSql" in databaseGlobal) {
    return databaseGlobal.__rahmatOtpOrderSql ?? null;
  }

  const databaseUrl = getDatabaseUrl();
  databaseGlobal.__rahmatOtpOrderSql = databaseUrl ? neon(databaseUrl) : null;

  return databaseGlobal.__rahmatOtpOrderSql;
}

export function isOrderDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

function parseOrder(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Order;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value) && "id" in value) {
    return value as Order;
  }

  return null;
}

function stripOrderToken(order: Order) {
  const { contextToken, ...snapshot } = order;
  void contextToken;
  return snapshot;
}

async function ensureOrdersTable() {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  if (!databaseGlobal.__rahmatOtpOrdersTableReady) {
    databaseGlobal.__rahmatOtpOrdersTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS otp_orders (
          order_id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          data JSONB NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS otp_orders_created_at_idx
        ON otp_orders (created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS otp_orders_updated_at_idx
        ON otp_orders (updated_at DESC)
      `;

      return true;
    })().catch((error) => {
      databaseGlobal.__rahmatOtpOrdersTableReady = undefined;
      throw error;
    });
  }

  return databaseGlobal.__rahmatOtpOrdersTableReady;
}

export async function saveOrderToDatabase(order: Order) {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  await ensureOrdersTable();

  const snapshot = stripOrderToken(order);
  const updatedAt = new Date().toISOString();

  await sql`
    INSERT INTO otp_orders (
      order_id,
      status,
      created_at,
      updated_at,
      data
    )
    VALUES (
      ${order.id},
      ${order.status},
      ${order.createdAt},
      ${updatedAt},
      ${JSON.stringify(snapshot)}::jsonb
    )
    ON CONFLICT (order_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at,
      data = EXCLUDED.data
  `;

  return true;
}

export async function getOrderFromDatabase(orderId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureOrdersTable();

  const rows = (await sql`
    SELECT order_id, data
    FROM otp_orders
    WHERE order_id = ${orderId}
    LIMIT 1
  `) as StoredOrderRow[];

  const order = parseOrder(rows[0]?.data);

  return order ? attachOrderContextToken(order) : null;
}

export async function listOrdersFromDatabase(limit = 20) {
  const sql = getSql();

  if (!sql) {
    return [] as Order[];
  }

  await ensureOrdersTable();

  const rows = (await sql`
    SELECT order_id, data
    FROM otp_orders
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, limit)}
  `) as StoredOrderRow[];

  return rows
    .map((row) => parseOrder(row.data))
    .filter((order): order is Order => order !== null)
    .map((order) => attachOrderContextToken(order));
}
