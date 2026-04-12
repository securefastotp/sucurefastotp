import { CatalogConsole } from "@/components/catalog-console";
import { getBalance, getHistory, getRuntimeStatus } from "@/lib/provider";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const [runtime, balance, history] = await Promise.all([
    getRuntimeStatus(),
    getBalance().catch(() => null),
    getHistory().catch(() => null),
  ]);
  const initialHistory = history ?? {
    updatedAt: new Date().toISOString(),
    mode: runtime.providerMode,
    total: 0,
    orders: [],
  };

  return (
    <main className="min-h-[100dvh]">
      <CatalogConsole
        initialBalance={balance}
        initialHistory={initialHistory}
        initialRuntime={runtime}
      />
    </main>
  );
}
