import AuthGuard from "@/_components/AuthGuard";
import ProjectListClose from "@/_screens/service/ProjectListClose";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "account_admin", "head_technician"]}>
      <ProjectListClose />
    </AuthGuard>
  );
}
