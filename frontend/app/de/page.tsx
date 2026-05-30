import OffersTableDE from "@/components/OffersTableDE";
export const dynamic = "force-dynamic";
export default function PageDE() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Angebote</h1>
      <p className="text-sm text-zinc-400">
        Grün = Marge ≥ "gut", Gelb = ≥ "mittel", Grau = darunter. Klicken Sie auf eine Zeile, um das Angebot zu öffnen.
      </p>
      <OffersTableDE />
    </div>
  );
}
