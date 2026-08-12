/**
 * One craftsman vehicle — SERVER component. Today's track, fuel and driver
 * scores are fetched here so the page arrives complete; changing the date range
 * re-queries from the client.
 */
import { getVehicleDetail } from "@/_actions/vehicles";
import VehicleDetailClient from "./VehicleDetailClient";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const today = new Date().toISOString().slice(0, 10);
  const res = await getVehicleDetail(decodeURIComponent(key), today, today);
  return <VehicleDetailClient initial={res.success ? res.data : null} />;
}
