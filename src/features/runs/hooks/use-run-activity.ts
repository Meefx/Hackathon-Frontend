"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "@/lib/http";
import { getRunActivity } from "../api";
import type { RunActivityState, RunSnapshot } from "../types";

const emptyActivity: RunActivityState = {
  source: "backend", status: "not_started", events: [], truncated: false,
  reasonCode: null, error: "", loading: true,
};

export function useRunActivity(id: string, run: RunSnapshot | null, revision: number) {
  const [state, setState] = useState({ id, activity: emptyActivity });
  const cache = useRef({ id, sequence: -1, activity: emptyActivity });
  const version = run?.version;
  const status = run?.status;

  useEffect(() => {
    if (cache.current.id !== id) cache.current = { id, sequence: -1, activity: emptyActivity };
    const current = cache.current;
    setState({ id, activity: current.activity });
    if (status === undefined) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const activeRun = status === "queued" || status === "running";

    function publish(activity: RunActivityState) {
      current.activity = activity;
      setState({ id, activity });
    }
    async function poll() {
      try {
        let hasMore = false;
        for (let page = 0; page < 5; page += 1) {
          const batch = await getRunActivity(id, current.sequence, controller.signal);
          if (controller.signal.aborted) return;
          if (!Array.isArray(batch.events) || !Number.isInteger(batch.next_sequence)) {
            throw new Error("Activity telemetry could not be verified.");
          }
          const seen = new Set(current.activity.events.map(event => event.sequence));
          const events = [...current.activity.events, ...batch.events.filter(event => {
            if (seen.has(event.sequence)) return false;
            seen.add(event.sequence);
            return true;
          })]
            .sort((a, b) => a.sequence - b.sequence);
          const previous = current.sequence;
          current.sequence = Math.max(previous, batch.next_sequence, ...batch.events.map(event => event.sequence));
          publish({
            source: batch.source, status: batch.status, events,
            truncated: current.activity.truncated || batch.truncated,
            reasonCode: batch.reason_code, error: "", loading: false,
          });
          hasMore = batch.has_more && current.sequence > previous;
          if (!hasMore) break;
        }
        failures = 0;
        if (hasMore || activeRun) timer = setTimeout(poll, hasMore ? 250 : 2000);
      } catch (reason) {
        if (controller.signal.aborted) return;
        publish({ ...current.activity, status: "unavailable", error: errorMessage(reason), loading: false });
        if (reason instanceof ApiError && reason.status === 404) return;
        failures += 1;
        timer = setTimeout(poll, Math.min(30000, 2000 * 2 ** Math.min(failures, 4)));
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, version, status, revision]);

  return state.id === id ? state.activity : emptyActivity;
}
