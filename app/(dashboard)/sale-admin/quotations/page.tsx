import AuthGuard from "@/_components/AuthGuard";
import QuotationList from "@/_screens/saleadmin/QuotationList";

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin", "sale_manager"]}>
      <QuotationList />
    </AuthGuard>
  );
}
