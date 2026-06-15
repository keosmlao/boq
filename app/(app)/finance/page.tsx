import { getAllContractsForList } from "@/_actions/contracts";
import FinanceClient from "./FinanceClient";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const res: any = await getAllContractsForList();
  const initialRows = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
  return <FinanceClient initialRows={initialRows} />;
}
