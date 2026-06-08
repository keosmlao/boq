import AuthGuard from "@/_components/AuthGuard";
import CreateQuotation from "../../_components/CreateQuotation";

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin", "sale_manager"]}>
      <CreateQuotation />
    </AuthGuard>
  );
}
