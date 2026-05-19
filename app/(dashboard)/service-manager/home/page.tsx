import AuthGuard from "@/_components/AuthGuard";
import ServiceManagerPage from "@/_screens/ServiceManagerPage";

export default function Page() {
  return (
    <AuthGuard roles={["service_manager"]}>
      <ServiceManagerPage />
    </AuthGuard>
  );
}
