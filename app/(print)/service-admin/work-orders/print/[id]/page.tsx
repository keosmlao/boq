import AuthGuard from "@/_components/AuthGuard";
import PrintWorkOrder from "@/_screens/service/PrintWorkOrder";

export default function Page() {
  return (
    <AuthGuard>
      <PrintWorkOrder />
    </AuthGuard>
  );
}
