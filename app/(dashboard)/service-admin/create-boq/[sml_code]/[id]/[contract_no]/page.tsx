import AuthGuard from "@/_components/AuthGuard";
import BoqCreate from "@/_screens/service/BoqCreate";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "head_technician"]}>
      <BoqCreate />
    </AuthGuard>
  );
}
