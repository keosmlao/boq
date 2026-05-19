import AuthGuard from "@/_components/AuthGuard";
import ProjectInstallments from "@/_screens/service/ProjectInstallments";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "account_admin", "head_technician"]}>
      <ProjectInstallments />
    </AuthGuard>
  );
}
