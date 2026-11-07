"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, type Page } from "@/lib/http";
import { getKnowledge } from "@/features/knowledge/api";
import type { KnowledgeSnapshot } from "@/features/knowledge/types";

export function useKnowledgePages(runId: string, runVersion: number) {
  const [pages, setPages] = useState<Record<number, Page<KnowledgeSnapshot>>>({});
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);

  // Revalidate one page per version update while retaining immutable cached pages.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getKnowledge(runId, controller.signal, offset)
      .then((page) => {
        if (controller.signal.aborted) return;
        if (!page.items.length && offset < page.total)
          throw new Error(
            "Knowledge snapshot page is incomplete. Retry this page.",
          );
        setPages((previous) => ({ ...previous, [offset]: page }));
        setTotal(page.total);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [runId, runVersion, offset, revision]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError("");
    setPages({});
    setTotal(0);
    setOffset(0);
    setRevision((value) => value + 1);
  }, []);
  const retry = useCallback(() => {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }, []);
  const loadPage = (page: number) => {
    const nextOffset = (page - 1) * 20;
    if (Number.isInteger(page) && page > 0 && nextOffset < total) {
      setLoading(true);
      setOffset(nextOffset);
      if (nextOffset === offset) retry();
    }
  };
  const orderedOffsets = Object.keys(pages).map(Number).sort((a, b) => a - b);
  const snapshots = orderedOffsets.flatMap((key) => pages[key].items);
  let nextOffset = 0;
  while (
    nextOffset < total &&
    pages[nextOffset] &&
    pages[nextOffset].items.length >= Math.min(20, total - nextOffset)
  ) nextOffset += 20;

  return {
    snapshots,
    total,
    loading,
    error,
    refresh,
    retry,
    loadPage,
    hasLoaded: orderedOffsets.length > 0,
    hasMore: nextOffset < total,
    nextPage: nextOffset / 20 + 1,
    pageCount: Math.ceil(total / 20),
  };
}
