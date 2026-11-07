import { Suspense } from "react";
import { ManagerWorkspace } from "@/features/manager/components/manager-workspace";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading manager…</p>}>
      <ManagerWorkspace />
    </Suspense>
  );
}
