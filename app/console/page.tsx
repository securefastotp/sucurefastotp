import { CatalogConsole } from "@/components/catalog-console";
import { getCatalog, getCountries, getRuntimeStatus } from "@/lib/provider";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const runtime = await getRuntimeStatus();
  const initialCountries = await getCountries("bimasakti").catch(() => []);
  const initialCountryId =
    initialCountries.find((country) => country.id === 6)?.id ??
    initialCountries[0]?.id ??
    null;
  const initialCatalog = initialCountryId
    ? await getCatalog({
        serverId: "bimasakti",
        countryId: initialCountryId,
      }).catch(() => null)
    : null;

  return (
    <main className="min-h-[100dvh]">
      <CatalogConsole
        initialCatalog={initialCatalog}
        initialCountries={initialCountries}
        initialCountryId={initialCountryId}
        initialRuntime={runtime}
      />
    </main>
  );
}
