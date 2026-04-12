export function getPricingConfig() {
  const markupPercent = Number(process.env.UPSTREAM_MARKUP_PERCENT ?? 15);
  const minMargin = Number(process.env.UPSTREAM_MIN_MARGIN ?? 500);
  const currency = process.env.UPSTREAM_CURRENCY ?? "IDR";

  return {
    markupPercent: Number.isFinite(markupPercent) ? markupPercent : 15,
    minMargin: Number.isFinite(minMargin) ? minMargin : 500,
    currency,
  };
}

export function computeRetailPrice(upstreamPrice: number) {
  const { markupPercent, minMargin } = getPricingConfig();
  const margin = Math.max(minMargin, upstreamPrice * (markupPercent / 100));

  return Math.round(upstreamPrice + margin);
}
