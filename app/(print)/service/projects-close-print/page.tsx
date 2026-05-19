import { Suspense } from "react";
import ProjectListClosePrint from "@/_screens/service/ProjectListClosePrint";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProjectListClosePrint />
    </Suspense>
  );
}
