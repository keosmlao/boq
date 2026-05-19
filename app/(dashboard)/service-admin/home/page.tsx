import AuthGuard from "@/_components/AuthGuard";
import ServiceAdminPage from "@/_screens/ServiceAdminPage";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "head_technician"]}>
      <ServiceAdminPage />
    </AuthGuard>
  );
}
