import { get, post, query, type Page } from "@/lib/http";
import type {
  ReviewItem,
  ReviewResolution,
  ReviewResolutionResult,
} from "./types";
export const getReviews = (offset = 0, status = "", signal?: AbortSignal) =>
  get<Page<ReviewItem>>(
    `/api/v1/reviews?${query({ offset, limit: 20, status })}`,
    signal,
  );
export const getReview = (id: string, signal?: AbortSignal) =>
  get<ReviewItem>(`/api/v1/reviews/${encodeURIComponent(id)}`, signal);
export const resolveReview = (id: string, body: ReviewResolution) =>
  post<ReviewResolutionResult>(
    `/api/v1/reviews/${encodeURIComponent(id)}/resolve`,
    body,
  );
