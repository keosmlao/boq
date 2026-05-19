import AuthGuard from "@/_components/AuthGuard";
import ProjectList from "@/_screens/saleadmin/ProjectList";

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin", "sale_manager", "account_admin", "head_technician"]}>
      <ProjectList />
    </AuthGuard>
  );
}
