import AuthGuard from "@/_components/AuthGuard";
import ContractDetail from "@/_screens/saleadmin/ContractDetail";

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin", "sale_manager", "account_admin"]}>
      <ContractDetail />
    </AuthGuard>
  );
}
