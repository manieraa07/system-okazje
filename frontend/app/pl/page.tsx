import OffersTable from "@/components/OffersTable";
export const dynamic = "force-dynamic";
export default function PagePL() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Oferty — Rynek Polski</h1>
        <p className="text-zinc-500 text-sm mt-1">OLX · Allegro · Vinted</p>
      </div>
      <OffersTable />
    </div>
  );
}
