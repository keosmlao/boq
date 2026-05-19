import AuthGuard from "@/_components/AuthGuard";
import WorkSchedule from "@/_screens/service/WorkSchedule";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "account_admin", "head_technician"]}>
      <WorkSchedule />
    </AuthGuard>
  );
}
