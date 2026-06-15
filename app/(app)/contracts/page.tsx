import { getAllContractsForList } from "@/_actions/contracts";
import ContractsClient from "./ContractsClient";

export const dynamic = "force-dynamic";

export default async function ContractsListPage() {
  const res: any = await getAllContractsForList();
  const initialRows = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
  return <ContractsClient initialRows={initialRows} />;
}
