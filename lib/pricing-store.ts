import "server-only";

import { neon } from "@neondatabase/serverless";
import type { PricingSettings, ServicePriceOverride } from "@/lib/types";

type NeonSql = ReturnType<typeof neon>;

type StoredPricingConfigRow = {
  config_key: string;
  profit_percent: number | string | null;
  min_margin: number | string | null;
  currency: string | null;
  updated_at: string;
};

type StoredPricingOverrideRow = {
  service_id: string;
  service_code: string;
  service_name: string;
  server_id: string;
  country_id: number;
  country_name: string;
  custom_price: number | string;
  upstream_price: number | string;
  updated_at: string;
};

const databaseGlobal = globalThis as typeof globalThis & {
  __rahmatOtpPricingSql?: NeonSql | null;
  __rahmatOtpPricingTablesReady?: Promise<boolean>;
};

function getDatabaseUrl() {
  return process.env.POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
}

function getSql() {
  if ("__rahmatOtpPricingSql" in databaseGlobal) {
    return databaseGlobal.__rahmatOtpPricingSql ?? null;
  }

  const databaseUrl = getDatabaseUrl();
  databaseGlobal.__rahmatOtpPricingSql = databaseUrl ? neon(databaseUrl) : null;
  return databaseGlobal.__rahmatOtpPricingSql;
}

function toNumber(value: number | string | null | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function getDefaultSettings(): PricingSettings {
  const currency = process.env.UPSTREAM_CURRENCY ?? "IDR";
  const markupPercent = Number(process.env.DEFAULT_PROFIT_PERCENT ?? 0);
  const minMargin = Number(process.env.DEFAULT_MIN_MARGIN ?? 0);

  return {
    profitPercent: Number.isFinite(markupPercent) ? markupPercent : 0,
    minMargin: Number.isFinite(minMargin) ? Math.max(0, Math.round(minMargin)) : 0,
    currency,
    updatedAt: null,
  };
}

async function ensurePricingTables() {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  if (!databaseGlobal.__rahmatOtpPricingTablesReady) {
    databaseGlobal.__rahmatOtpPricingTablesReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_pricing_settings (
          config_key TEXT PRIMARY KEY,
          profit_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
          min_margin INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'IDR',
          updated_at TIMESTAMPTZ NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS app_service_price_overrides (
          service_id TEXT PRIMARY KEY,
          service_code TEXT NOT NULL,
          service_name TEXT NOT NULL,
          server_id TEXT NOT NULL,
          country_id INTEGER NOT NULL,
          country_name TEXT NOT NULL,
          custom_price INTEGER NOT NULL,
          upstream_price INTEGER NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS app_service_price_overrides_scope_idx
        ON app_service_price_overrides (server_id, country_id, updated_at DESC)
      `;

      return true;
    })().catch((error) => {
      databaseGlobal.__rahmatOtpPricingTablesReady = undefined;
      throw error;
    });
  }

  return databaseGlobal.__rahmatOtpPricingTablesReady;
}

function mapSettingsRow(row?: StoredPricingConfigRow): PricingSettings {
  const defaults = getDefaultSettings();

  if (!row) {
    return defaults;
  }

  return {
    profitPercent: toNumber(row.profit_percent, defaults.profitPercent),
    minMargin: Math.max(0, Math.round(toNumber(row.min_margin, defaults.minMargin))),
    currency: row.currency?.trim() || defaults.currency,
    updatedAt: row.updated_at,
  };
}

function mapOverrideRow(row: StoredPricingOverrideRow): ServicePriceOverride {
  return {
    serviceId: row.service_id,
    serviceCode: row.service_code,
    service: row.service_name,
    serverId: row.server_id,
    countryId: row.country_id,
    country: row.country_name,
    customPrice: Math.max(1, Math.round(toNumber(row.custom_price, 0))),
    upstreamPrice: Math.max(0, Math.round(toNumber(row.upstream_price, 0))),
    updatedAt: row.updated_at,
  };
}

export async function getStoredPricingSettings() {
  const sql = getSql();

  if (!sql) {
    return getDefaultSettings();
  }

  await ensurePricingTables();

  const rows = (await sql`
    SELECT config_key, profit_percent, min_margin, currency, updated_at
    FROM app_pricing_settings
    WHERE config_key = 'default'
    LIMIT 1
  `) as StoredPricingConfigRow[];

  return mapSettingsRow(rows[0]);
}

export async function saveStoredPricingSettings(input: { profitPercent: number }) {
  const sql = getSql();
  const defaults = getDefaultSettings();

  if (!sql) {
    return {
      ...defaults,
      profitPercent: input.profitPercent,
      updatedAt: new Date().toISOString(),
    } satisfies PricingSettings;
  }

  await ensurePricingTables();

  const updatedAt = new Date().toISOString();
  const profitPercent = Number.isFinite(input.profitPercent)
    ? Math.max(0, input.profitPercent)
    : defaults.profitPercent;

  await sql`
    INSERT INTO app_pricing_settings (
      config_key,
      profit_percent,
      min_margin,
      currency,
      updated_at
    )
    VALUES (
      'default',
      ${profitPercent},
      ${defaults.minMargin},
      ${defaults.currency},
      ${updatedAt}
    )
    ON CONFLICT (config_key)
    DO UPDATE SET
      profit_percent = EXCLUDED.profit_percent,
      min_margin = EXCLUDED.min_margin,
      currency = EXCLUDED.currency,
      updated_at = EXCLUDED.updated_at
  `;

  return {
    profitPercent,
    minMargin: defaults.minMargin,
    currency: defaults.currency,
    updatedAt,
  } satisfies PricingSettings;
}

export async function listStoredPriceOverrides(limit = 40) {
  const sql = getSql();

  if (!sql) {
    return [] as ServicePriceOverride[];
  }

  await ensurePricingTables();

  const rows = (await sql`
    SELECT
      service_id,
      service_code,
      service_name,
      server_id,
      country_id,
      country_name,
      custom_price,
      upstream_price,
      updated_at
    FROM app_service_price_overrides
    ORDER BY updated_at DESC
    LIMIT ${Math.max(1, limit)}
  `) as StoredPricingOverrideRow[];

  return rows.map(mapOverrideRow);
}

export async function listStoredPriceOverridesByScope(serverId: string, countryId: number) {
  const sql = getSql();

  if (!sql) {
    return [] as ServicePriceOverride[];
  }

  await ensurePricingTables();

  const rows = (await sql`
    SELECT
      service_id,
      service_code,
      service_name,
      server_id,
      country_id,
      country_name,
      custom_price,
      upstream_price,
      updated_at
    FROM app_service_price_overrides
    WHERE server_id = ${serverId} AND country_id = ${countryId}
    ORDER BY updated_at DESC
  `) as StoredPricingOverrideRow[];

  return rows.map(mapOverrideRow);
}

export async function saveStoredPriceOverride(input: {
  serviceId: string;
  serviceCode: string;
  service: string;
  serverId: string;
  countryId: number;
  country: string;
  customPrice: number;
  upstreamPrice: number;
}) {
  const sql = getSql();
  const customPrice = Math.max(1, Math.round(input.customPrice));
  const upstreamPrice = Math.max(0, Math.round(input.upstreamPrice));
  const updatedAt = new Date().toISOString();

  if (!sql) {
    return {
      serviceId: input.serviceId,
      serviceCode: input.serviceCode,
      service: input.service,
      serverId: input.serverId,
      countryId: input.countryId,
      country: input.country,
      customPrice,
      upstreamPrice,
      updatedAt,
    } satisfies ServicePriceOverride;
  }

  await ensurePricingTables();

  await sql`
    INSERT INTO app_service_price_overrides (
      service_id,
      service_code,
      service_name,
      server_id,
      country_id,
      country_name,
      custom_price,
      upstream_price,
      updated_at
    )
    VALUES (
      ${input.serviceId},
      ${input.serviceCode},
      ${input.service},
      ${input.serverId},
      ${input.countryId},
      ${input.country},
      ${customPrice},
      ${upstreamPrice},
      ${updatedAt}
    )
    ON CONFLICT (service_id)
    DO UPDATE SET
      service_code = EXCLUDED.service_code,
      service_name = EXCLUDED.service_name,
      server_id = EXCLUDED.server_id,
      country_id = EXCLUDED.country_id,
      country_name = EXCLUDED.country_name,
      custom_price = EXCLUDED.custom_price,
      upstream_price = EXCLUDED.upstream_price,
      updated_at = EXCLUDED.updated_at
  `;

  return {
    serviceId: input.serviceId,
    serviceCode: input.serviceCode,
    service: input.service,
    serverId: input.serverId,
    countryId: input.countryId,
    country: input.country,
    customPrice,
    upstreamPrice,
    updatedAt,
  } satisfies ServicePriceOverride;
}

export async function deleteStoredPriceOverride(serviceId: string) {
  const sql = getSql();

  if (!sql) {
    return false;
  }

  await ensurePricingTables();
  await sql`
    DELETE FROM app_service_price_overrides
    WHERE service_id = ${serviceId}
  `;

  return true;
}
