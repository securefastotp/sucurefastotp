import "server-only";

import {
  getStoredPricingSettings,
  listStoredPriceOverrides,
  listStoredPriceOverridesByScope,
  saveStoredPriceOverride,
  saveStoredPricingSettings,
  deleteStoredPriceOverride,
} from "@/lib/pricing-store";
import type {
  PricingSettings,
  RuntimeStatus,
  Service,
  ServicePriceOverride,
} from "@/lib/types";

export function getPricingConfig() {
  const currency = process.env.UPSTREAM_CURRENCY ?? "IDR";
  const markupPercent = Number(process.env.DEFAULT_PROFIT_PERCENT ?? 0);
  const minMargin = Number(process.env.DEFAULT_MIN_MARGIN ?? 0);

  return {
    markupPercent: Number.isFinite(markupPercent) ? markupPercent : 0,
    minMargin: Number.isFinite(minMargin) ? Math.max(0, Math.round(minMargin)) : 0,
    currency,
  };
}

export function computeRetailPrice(
  upstreamPrice: number,
  options?: {
    overridePrice?: number;
    markupPercent?: number;
    minMargin?: number;
  },
) {
  const basePrice = Math.max(0, Math.round(upstreamPrice));
  const overridePrice = options?.overridePrice;

  if (typeof overridePrice === "number" && Number.isFinite(overridePrice) && overridePrice > 0) {
    return Math.round(overridePrice);
  }

  const defaults = getPricingConfig();
  const markupPercent =
    typeof options?.markupPercent === "number" && Number.isFinite(options.markupPercent)
      ? Math.max(0, options.markupPercent)
      : defaults.markupPercent;
  const minMargin =
    typeof options?.minMargin === "number" && Number.isFinite(options.minMargin)
      ? Math.max(0, Math.round(options.minMargin))
      : defaults.minMargin;
  const margin = Math.max(Math.ceil(basePrice * (markupPercent / 100)), minMargin);

  return Math.max(basePrice + margin, basePrice);
}

export async function getEffectivePricingSettings(): Promise<PricingSettings> {
  const defaults = getPricingConfig();
  const stored = await getStoredPricingSettings();

  return {
    profitPercent: stored.profitPercent,
    minMargin: stored.minMargin,
    currency: stored.currency || defaults.currency,
    updatedAt: stored.updatedAt ?? null,
  };
}

export async function getPricingRulesForCatalog(serverId: string, countryId: number) {
  const [config, overrides] = await Promise.all([
    getEffectivePricingSettings(),
    listStoredPriceOverridesByScope(serverId, countryId),
  ]);

  return {
    config,
    overridesMap: new Map(overrides.map((override) => [override.serviceId, override])),
  };
}

export function applyPricingToService(
  service: Service,
  pricing: {
    config: PricingSettings;
    overridesMap: Map<string, ServicePriceOverride>;
  },
) {
  const override = pricing.overridesMap.get(service.id);
  const price = computeRetailPrice(service.upstreamPrice, {
    overridePrice: override?.customPrice,
    markupPercent: pricing.config.profitPercent,
    minMargin: pricing.config.minMargin,
  });

  return {
    ...service,
    currency: pricing.config.currency,
    price,
  } satisfies Service;
}

export async function getAdminPricingState(limit = 40) {
  const [config, overrides] = await Promise.all([
    getEffectivePricingSettings(),
    listStoredPriceOverrides(limit),
  ]);

  return {
    config,
    overrides,
  };
}

export async function updateAdminProfitPercent(profitPercent: number) {
  return await saveStoredPricingSettings({ profitPercent });
}

export async function updateAdminServiceOverride(input: {
  serviceId: string;
  serviceCode: string;
  service: string;
  serverId: string;
  countryId: number;
  country: string;
  customPrice: number;
  upstreamPrice: number;
}) {
  return await saveStoredPriceOverride(input);
}

export async function removeAdminServiceOverride(serviceId: string) {
  return await deleteStoredPriceOverride(serviceId);
}

export async function getPricingRuntimeStatus(): Promise<
  Pick<RuntimeStatus, "markupPercent" | "minMargin" | "currency">
> {
  const settings = await getEffectivePricingSettings();

  return {
    markupPercent: settings.profitPercent,
    minMargin: settings.minMargin,
    currency: settings.currency,
  };
}
