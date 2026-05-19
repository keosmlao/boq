import AuthGuard from "@/_components/AuthGuard";
import ManageTechnicians from "@/_screens/service/ManageTechnicians";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "head_technician"]}>
      <ManageTechnicians />
    </AuthGuard>
  );
}
