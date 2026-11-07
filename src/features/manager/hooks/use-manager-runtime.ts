"use client";

import { useEffect, useState } from "react";
import { getAgents } from "@/features/agents/api";
import { getIntegrations } from "@/features/integrations/api";
import { useRemote } from "@/hooks/use-remote";
import type { ChatRunRequest } from "../types";

type RuntimeMode = ChatRunRequest["runtime_mode"];
const preferenceKey = "graceline.manager-runtime.v1";

export function useManagerRuntime() {
  const agents = useRemote(getAgents);
  const integrations = useRemote(getIntegrations);
  const [preference, setPreference] = useState<RuntimeMode | null>(null);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(preferenceKey);
      if (saved === "simulated" || saved === "hermes") setPreference(saved);
    } catch {
      setStorageWarning(true);
    }
    setReady(true);
  }, []);

  const manager = agents.data?.items.find(item => item.role === "manager");
  const configuredMode = manager?.runtime_mode === "hermes" ? "hermes" : "simulated";
  const mode = preference || configuredMode;
  const runtime = integrations.data?.items.find(item =>
    item.id.toLowerCase() === (mode === "simulated" ? "simulated_runtime" : "hermes"),
  );
  const loading = !ready || agents.loading || integrations.loading;
  const available = !loading && (runtime
    ? runtime.implemented && runtime.configured && runtime.health !== "unavailable"
    : !!manager?.available && manager.runtime_mode === mode);

  function changeMode(value: RuntimeMode | null) {
    setPreference(value);
    try {
      if (value) localStorage.setItem(preferenceKey, value);
      else localStorage.removeItem(preferenceKey);
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }

  return {
    mode, preference, loading, available, storageWarning,
    health: runtime?.health,
    error: agents.error || integrations.error,
    changeMode,
    refresh: () => { agents.refresh(); integrations.refresh(); },
  };
}
