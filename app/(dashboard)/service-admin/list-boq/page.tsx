"use client";

import AuthGuard from "@/_components/AuthGuard";
import BoqListView from "@/_components/boq/BoqListView";

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "account_admin", "head_technician"]}>
      <BoqListView />
    </AuthGuard>
  );
}
