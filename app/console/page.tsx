import { MemberConsole } from "@/components/member-console";
import { getCurrentViewer } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/member-service";
import { getCatalog, getCountries } from "@/lib/provider";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const initialViewer = await getCurrentViewer().catch(() => null);
  const initialSummary = initialViewer
    ? await getDashboardSummary(initialViewer.id).catch(() => null)
    : null;
  const initialCountries = initialViewer
    ? await getCountries("bimasakti").catch(() => [])
    : [];
  const initialCountryId = initialViewer
    ? initialCountries.find(
        (country) => country.name.trim().toLowerCase() === "indonesia",
      )?.id ??
      initialCountries.find((country) => country.code.trim().toUpperCase() === "ID")
        ?.id ??
      initialCountries.find((country) => country.id === 88)?.id ??
      initialCountries[0]?.id ??
      null
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
