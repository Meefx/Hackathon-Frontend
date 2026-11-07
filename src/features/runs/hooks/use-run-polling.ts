"use client";

import { useEffect, useRef, useState } from "react";
import { getRun, getRunEvents } from "../api";
import type { RunEvent, RunSnapshot } from "../types";
import { errorMessage } from "@/lib/http";
import { useRunActivity } from "./use-run-activity";

export function useRunPolling(id: string) {
  const [run, setRun] = useState<RunSnapshot | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState("");
  const [delayed, setDelayed] = useState(false);
  const [revision, setRevision] = useState(0);
  const cache = useRef<{
    id: string;
    run: RunSnapshot | null;
    events: RunEvent[];
    sequence: number;
  }>({ id, run: null, events: [], sequence: 0 });

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    if (cache.current.id !== id)
      cache.current = { id, run: null, events: [], sequence: 0 };
    const current = cache.current;
    setRun(current.run);
    setEvents(current.events);
    setError("");
    setDelayed(false);

    async function poll() {
      try {
        const snapshot = await getRun(id, controller.signal);
        if (controller.signal.aborted) return;
        if (!current.run || snapshot.version > current.run.version) {
          current.run = snapshot;
          setRun(snapshot);
        }
        let hasMore = true;
        while (hasMore && !controller.signal.aborted) {
          const batch = await getRunEvents(
            id,
            current.sequence,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          const previousSequence = current.sequence;
          const next = batch.items
            .filter((item) => item.sequence > previousSequence)
            .sort((a, b) => a.sequence - b.sequence);
          if (next.length) {
            const seen = new Set(current.events.map((item) => item.sequence));
            current.events = [
              ...current.events,
              ...next.filter((item) => !seen.has(item.sequence)),
            ].sort((a, b) => a.sequence - b.sequence);
            setEvents(current.events);
          }
          current.sequence = Math.max(
            previousSequence,
            batch.next_sequence,
            ...next.map((item) => item.sequence),
          );
          hasMore = batch.has_more && current.sequence > previousSequence;
        }
        failures = 0;
        setError("");
        setDelayed(false);
        if (current.run && ["queued", "running"].includes(current.run.status))
          timer = setTimeout(poll, 2000);
      } catch (reason) {
        if (controller.signal.aborted) return;
        failures += 1;
        setError(errorMessage(reason));
        setDelayed(!!current.run);
        timer = setTimeout(
          poll,
          Math.min(30000, 2000 * 2 ** Math.min(failures, 4)),
        );
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, revision]);

  const visibleRun = run?.id === id ? run : null;
  const activity = useRunActivity(id, visibleRun, revision);

  return {
    run: visibleRun,
    events: visibleRun ? events : [],
    activity,
    error,
    delayed,
    refresh: () => setRevision((value) => value + 1),
  };
}
