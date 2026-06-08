"use client";


import AuthGuard from "@/_components/AuthGuard";
function AccPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">ACC Dashboard</h1>
      {/* Add your widgets or content here */}
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["account_admin"]}>
      <AccPage />
    </AuthGuard>
  );
}
