import { Suspense } from "react";
import { ReviewQueue } from "@/features/reviews/components/review-queue";
export default function Page() {
  return <Suspense fallback={<p>Loading reviews…</p>}><ReviewQueue /></Suspense>;
}
