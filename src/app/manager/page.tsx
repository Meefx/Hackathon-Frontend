import { Suspense } from "react";
import { ManagerChat } from "@/features/manager/components/manager-chat";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading manager…</p>}>
      <ManagerChat />
    </Suspense>
  );
}
