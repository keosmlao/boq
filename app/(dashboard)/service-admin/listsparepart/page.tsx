import AuthGuard from "@/_components/AuthGuard";
import BOQMaterialList from "@/_screens/service/BOQMaterialList";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "account_admin", "head_technician"]}>
      <BOQMaterialList />
    </AuthGuard>
  );
}
