// src/pages/Logout.jsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Logout() {
  const router = useRouter();

  useEffect(() => {
    localStorage.removeItem("token");
    document.cookie = "odg-auth=; path=/; max-age=0";
    router.push("/login");
  }, [router]);

  return <div className="p-4">Logging out...</div>;
}
