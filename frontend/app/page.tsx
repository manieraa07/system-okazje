import OffersTable from "@/components/OffersTable";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Oferty</h1>
      <p className="text-sm text-zinc-400">
        Zielony = marża ≥ próg „dobry”, żółty = ≥ próg „średni”, szary = poniżej. Kliknij wiersz, aby otworzyć ofertę w nowej karcie.
      </p>
      <OffersTable />
    </div>
  );
}
