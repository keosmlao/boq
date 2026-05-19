import AuthGuard from "@/_components/AuthGuard";
import ListApprove from "@/_screens/saleadmin/listwaitingaprove";

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin", "sale_manager", "account_admin"]}>
      <ListApprove />
    </AuthGuard>
  );
}
