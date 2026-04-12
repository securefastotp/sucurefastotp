import { CatalogConsole } from "@/components/catalog-console";
import { getBalance, getRuntimeStatus } from "@/lib/provider";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const [runtime, balance] = await Promise.all([
    getRuntimeStatus(),
    getBalance().catch(() => null),
  ]);

  return (
    <main className="min-h-[100dvh]">
      <CatalogConsole initialBalance={balance} initialRuntime={runtime} />
    </main>
  );
}
