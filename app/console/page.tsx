import { CatalogConsole } from "@/components/catalog-console";
import { getRuntimeStatus } from "@/lib/provider";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const runtime = await getRuntimeStatus();

  return (
    <main className="min-h-[100dvh]">
      <CatalogConsole initialRuntime={runtime} />
    </main>
  );
}
