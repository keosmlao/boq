import AuthGuard from "@/_components/AuthGuard";
import HeadTechnicianSummary from "@/_screens/headtech/HeadTechnicianSummary";

export default function Page() {
  return (
    <AuthGuard roles={["head_technician", "service_manager", "service_admin"]}>
      <HeadTechnicianSummary />
    </AuthGuard>
  );
}
