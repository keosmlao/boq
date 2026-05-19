import AuthGuard from "@/_components/AuthGuard";
import CreateProject from "./_components/CreateProject";

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin", "sale_manager"]}>
      <CreateProject />
    </AuthGuard>
  );
}
