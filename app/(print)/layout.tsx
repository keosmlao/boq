import type { ReactNode } from "react";

export default function PrintLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
