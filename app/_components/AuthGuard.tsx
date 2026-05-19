"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { hasAnyRole } from "@/_lib/auth";

export default function AuthGuard({ children, roles = [] }: { children: ReactNode; roles?: string[] }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      router.replace("/login");
      return;
    }

    if (roles.length === 0) {
      setAuthorized(true);
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (hasAnyRole(user, roles)) {
        setAuthorized(true);
      } else {
        router.replace("/unauthorized");
      }
    } catch {
      router.replace("/login");
    }
  }, [router, roles]);

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500">
        ກຳລັງກວດສອບສິດ...
      </div>
    );
  }

  return <>{children}</>;
}
