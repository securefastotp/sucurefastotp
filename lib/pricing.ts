export function getPricingConfig() {
  const currency = process.env.UPSTREAM_CURRENCY ?? "IDR";

  return {
    markupPercent: 100,
    minMargin: 0,
    currency,
  };
}

export function computeRetailPrice(upstreamPrice: number) {
  return Math.round(upstreamPrice * 2);
}
