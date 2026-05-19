import AuthGuard from "@/_components/AuthGuard";
import WorkOrders from "@/_screens/service/WorkOrders";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "account_admin", "head_technician"]}>
      <WorkOrders />
    </AuthGuard>
  );
}
