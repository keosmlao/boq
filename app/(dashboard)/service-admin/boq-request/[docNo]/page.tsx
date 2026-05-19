import AuthGuard from "@/_components/AuthGuard";
import BoqRequestPage from "@/_screens/service/BoqRequestModal";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "head_technician"]}>
      <BoqRequestPage />
    </AuthGuard>
  );
}
