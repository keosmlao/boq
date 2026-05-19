import AuthGuard from "@/_components/AuthGuard";
import TimesheetGrid from "@/_screens/timesheets/TimesheetGrid";

export default function Page() {
  return (
    <AuthGuard
      roles={[
        "sale_admin",
        "sale_manager",
        "service_admin",
        "service_manager",
        "head_technician",
        "account_admin",
      ]}
    >
      <TimesheetGrid />
    </AuthGuard>
  );
}
