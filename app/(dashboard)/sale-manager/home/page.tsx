import AuthGuard from "@/_components/AuthGuard";
import SaleManagerPage from "@/_screens/saleadmin/SaleManagerPage";

export default function Page() {
  return (
    <AuthGuard roles={["sale_manager"]}>
      <SaleManagerPage />
    </AuthGuard>
  );
}
