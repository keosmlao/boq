"use client";


import AuthGuard from "@/_components/AuthGuard";
function SaleManagerPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">SALE MANAGER Dashboard</h1>
      {/* Add your widgets or content here */}
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["sale_manager"]}>
      <SaleManagerPage />
    </AuthGuard>
  );
}
