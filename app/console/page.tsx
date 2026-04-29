import { MemberConsole } from "@/components/member-console";
import { getCurrentViewer } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/member-service";
import { getCatalog, getCountries } from "@/lib/provider";
import type { CountryOption } from "@/lib/types";

export const dynamic = "force-dynamic";

function pickPreferredCountryId(countries: CountryOption[]) {
  return (
    countries.find((country) => country.name.trim().toLowerCase() === "indonesia")
      ?.id ??
    countries.find((country) => country.code.trim().toUpperCase() === "ID")?.id ??
    countries.find((country) => country.id === 88)?.id ??
    countries[0]?.id ??
    null
  );
}

export default async function ConsolePage() {
  const initialViewer = await getCurrentViewer().catch(() => null);
  const initialSummary = initialViewer
    ? await getDashboardSummary(initialViewer.id).catch(() => null)
    : null;
  const initialCountries = initialViewer
    ? await getCountries("bimasakti").catch(() => [])
    : [];
  const initialCountryId = initialViewer
    ? pickPreferredCountryId(initialCountries)
    : null;
  const initialCatalog =
    initialViewer && initialCountryId
      ? await getCatalog({
          serverId: "bimasakti",
          countryId: initialCountryId,
        }).catch(() => null)
      : null;

  return (
    <main className="min-h-[100dvh]">
      <MemberConsole
        initialViewer={initialViewer}
        initialSummary={initialSummary}
        initialCatalog={initialCatalog}
        initialCountries={initialCountries}
        initialCountryId={initialCountryId}
      />
    </main>
  );
}
