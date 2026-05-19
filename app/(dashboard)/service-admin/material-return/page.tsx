import AuthGuard from "@/_components/AuthGuard";
import MaterialReturn from "@/_screens/service/MaterialReturn";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "head_technician"]}>
      <MaterialReturn />
    </AuthGuard>
  );
}
