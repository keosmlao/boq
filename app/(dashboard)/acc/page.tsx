import AuthGuard from "@/_components/AuthGuard";
import AccPage from "@/_screens/acc/AccPage";

export default function Page() {
  return (
    <AuthGuard roles={["account_admin"]}>
      <AccPage />
    </AuthGuard>
  );
}
