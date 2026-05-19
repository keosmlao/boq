import AuthGuard from "@/_components/AuthGuard";
import PrintWorkOrder from "@/_screens/service/PrintWorkOrder";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "account_admin", "head_technician"]}>
      <PrintWorkOrder />
    </AuthGuard>
  );
}
