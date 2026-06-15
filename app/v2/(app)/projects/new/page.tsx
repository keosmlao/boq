"use client";

/** v2 — Register project (create). Customer comes from ?cust=&name= (from the
 *  customer page). After save -> survey -> quotation. */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProjectForm from "../_ProjectForm";

function Inner() {
  const sp = useSearchParams();
  return (
    <ProjectForm
      mode="create"
      custCode={sp.get("cust") || undefined}
      custName={sp.get("name") || undefined}
    />
  );
}

export default function RegisterProjectPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
