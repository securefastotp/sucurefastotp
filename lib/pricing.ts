export function getPricingConfig() {
  const currency = process.env.UPSTREAM_CURRENCY ?? "IDR";

  return {
    markupPercent: 0,
    minMargin: 0,
    currency,
  };
}

export function computeRetailPrice(upstreamPrice: number) {
  return Math.round(upstreamPrice);
}
