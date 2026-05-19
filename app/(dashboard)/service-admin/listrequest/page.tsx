import AuthGuard from "@/_components/AuthGuard";
import ListRequest from "@/_screens/service/listrequest";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "head_technician"]}>
      <ListRequest />
    </AuthGuard>
  );
}
