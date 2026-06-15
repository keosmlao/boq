import { getQuotations } from "@/_actions/quotations";
import QuotationsClient from "./QuotationsClient";

export const dynamic = "force-dynamic";

export default async function QuotationsListPage() {
  const res: any = await getQuotations({});
  const initialRows = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
  return <QuotationsClient initialRows={initialRows} />;
}
