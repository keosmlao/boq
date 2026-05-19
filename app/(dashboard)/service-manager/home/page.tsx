"use client";


import AuthGuard from "@/_components/AuthGuard";
function ServiceManagerPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Service Manager Dashboard</h1>
      {/* Add your widgets or content here */}
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["service_manager"]}>
      <ServiceManagerPage />
    </AuthGuard>
  );
}
