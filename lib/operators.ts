export const DEFAULT_OPERATOR = "any";
export const INDONESIA_COUNTRY_ID = 6;

export const operatorOptions = [
  { id: DEFAULT_OPERATOR, label: "Random" },
  { id: "telkomsel", label: "Telkomsel" },
  { id: "indosat", label: "Indosat" },
  { id: "xl", label: "XL" },
  { id: "axis", label: "Axis" },
  { id: "tri", label: "Tri" },
  { id: "smartfren", label: "Smartfren" },
] as const;

const operatorIds = new Set(operatorOptions.map((operator) => operator.id));

export function normalizeOperator(value?: string | null) {
  const normalized = value?.trim().toLowerCase() || DEFAULT_OPERATOR;

  return operatorIds.has(normalized as (typeof operatorOptions)[number]["id"])
    ? normalized
    : DEFAULT_OPERATOR;
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

  return countryId === INDONESIA_COUNTRY_ID || normalized === DEFAULT_OPERATOR;
}

export function normalizeOperatorForCountry(
  countryId: number,
  operator?: string | null,
) {
  return isOperatorAllowedForCountry(countryId, operator)
    ? normalizeOperator(operator)
    : DEFAULT_OPERATOR;
}
