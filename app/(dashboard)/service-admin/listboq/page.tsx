import AuthGuard from "@/_components/AuthGuard";
import BOQDisplay from "@/_screens/service/listboq";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "account_admin", "head_technician"]}>
      <BOQDisplay />
    </AuthGuard>
  );
}
