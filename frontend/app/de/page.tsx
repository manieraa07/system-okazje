import OffersTableDE from "@/components/OffersTableDE";
export const dynamic = "force-dynamic";
export default function PageDE() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Angebote</h1>
      const EMPTY: Omit<WatchItem, "id"> = {
  name: "", keywords: [], exclude_terms: [],
  market_value: 0, max_buy_price: 0,
  good_margin_pct: 30, ok_margin_pct: 15, active: true, market: "pl",
};
      <OffersTableDE />
    </div>
  );
}
