"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthGuard({ children, roles = [] }) {
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
      const normalize = (r) => (r || "").toString().trim().toLowerCase();
      const activeRole = normalize(user.role);

      let userRoles = [];
      if (Array.isArray(user.allRoles)) {
        userRoles = user.allRoles.map(normalize);
      } else if (typeof user.allRoles === "string") {
        userRoles = user.allRoles
          .split(",")
          .map(normalize)
          .filter(Boolean);
      }

      const effectiveRoles = [
        ...new Set([activeRole, ...userRoles].filter(Boolean)),
      ];

      if (roles.some((r) => effectiveRoles.includes(r))) {
        setAuthorized(true);
      } else {
        router.replace("/unauthorized");
      }
    } catch {
      router.replace("/login");
    }
  }, []);

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500">
        ກຳລັງກວດສອບສິດ...
      </div>
    );
  }

  return <>{children}</>;
}
