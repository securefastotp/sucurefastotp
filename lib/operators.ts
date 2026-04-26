export const DEFAULT_OPERATOR = "any";
export const INDONESIA_COUNTRY_ID = 6;

const operatorLabelMap: Record<string, string> = {
  any: "Semua Provider",
  axis: "Axis",
  byu: "by.U",
  indosat: "Indosat",
  smartfren: "Smartfren",
  telkomsel: "Telkomsel",
  three: "Three",
  tri: "Tri",
  xl: "XL",
};

export const operatorOptions = [
  { id: DEFAULT_OPERATOR, label: operatorLabelMap.any },
  { id: "telkomsel", label: "Telkomsel" },
  { id: "indosat", label: "Indosat" },
  { id: "xl", label: "XL" },
  { id: "axis", label: "Axis" },
  { id: "three", label: "Three" },
  { id: "smartfren", label: "Smartfren" },
  { id: "byu", label: "by.U" },
] as const;

export function normalizeOperator(value?: string | null) {
  const normalized =
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "") || DEFAULT_OPERATOR;

  return normalized || DEFAULT_OPERATOR;
}

export function getOperatorLabel(operator: string) {
  const normalized = normalizeOperator(operator);
  const titleCased = normalized
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (operatorLabelMap[normalized] ?? titleCased) || operatorLabelMap.any;
}

export function getOperatorOptionsForCountry(countryId?: number | null) {
  return countryId === INDONESIA_COUNTRY_ID
    ? operatorOptions
    : operatorOptions.slice(0, 1);
}

export function isOperatorAllowedForCountry(
  countryId: number,
  operator?: string | null,
) {
  const normalized = normalizeOperator(operator);

  return (
    Number.isFinite(countryId) &&
    countryId >= 0 &&
    /^[a-z0-9_-]{1,48}$/.test(normalized)
  );
}

export function normalizeOperatorForCountry(
  countryId: number,
  operator?: string | null,
) {
  return isOperatorAllowedForCountry(countryId, operator)
    ? normalizeOperator(operator)
    : DEFAULT_OPERATOR;
}
