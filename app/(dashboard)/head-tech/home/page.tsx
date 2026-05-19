import AuthGuard from "@/_components/AuthGuard";
import HeadTechnicianHome from "@/_screens/headtech/HeadTechnicianHome";

export default function Page() {
  return (
    <AuthGuard roles={["head_technician"]}>
      <HeadTechnicianHome />
    </AuthGuard>
  );
}
