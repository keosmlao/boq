import AuthGuard from "@/_components/AuthGuard";
import MaterialReturnList from "@/_screens/service/MaterialReturnList";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "account_admin", "head_technician"]}>
      <MaterialReturnList />
    </AuthGuard>
  );
}
