import AuthGuard from "@/_components/AuthGuard";
import SaleAdminPage from "@/_screens/saleadmin/SaleAdminPage";

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin"]}>
      <SaleAdminPage />
    </AuthGuard>
  );
}
