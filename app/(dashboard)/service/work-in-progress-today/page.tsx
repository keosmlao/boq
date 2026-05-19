import AuthGuard from "@/_components/AuthGuard";
import WorkInProgressToday from "@/_screens/service/WorkInProgressToday";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "head_technician"]}>
      <WorkInProgressToday />
    </AuthGuard>
  );
}
