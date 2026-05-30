import OffersTable from "@/components/OffersTable";
export const dynamic = "force-dynamic";
export default function PagePL() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">🇵🇱</span>
        <div>
          <h1 className="text-xl font-bold">Rynek Polski</h1>
          <p className="text-sm text-zinc-400">OLX · Allegro · Vinted</p>
        </div>
      </div>
      <OffersTable />
    </div>
  );
}
