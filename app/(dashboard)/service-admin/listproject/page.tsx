import AuthGuard from "@/_components/AuthGuard";
import ProjectListService from "@/_screens/service/ProjectListService";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "head_technician"]}>
      <ProjectListService />
    </AuthGuard>
  );
}
