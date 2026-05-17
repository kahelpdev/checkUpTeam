"use client";
import { useState, useEffect, useCallback } from "react";

export interface Team {
  id: string;
  teamId: string;
  teamName: string;
  isActive: boolean;
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => setTeams(data))
      .finally(() => setLoading(false));
  }, []);

  return { teams, loading };
}

const STORAGE_KEY = "checkup_selected_team";

export function useSelectedTeam() {
  const { teams, loading } = useTeams();
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(STORAGE_KEY) || "";
    }
    return "";
  });

  // Seleciona o primeiro time ativo automaticamente
  useEffect(() => {
    if (!loading && teams.length > 0 && !selectedId) {
      const first = (teams.find((t) => t.isActive) ?? teams[0]).id;
      setSelectedId(first);
      sessionStorage.setItem(STORAGE_KEY, first);
    }
  }, [loading, teams, selectedId]);

  const selectTeam = useCallback((id: string) => {
    setSelectedId(id);
    sessionStorage.setItem(STORAGE_KEY, id);
  }, []);

  const selectedTeam = teams.find((t) => t.id === selectedId) ?? null;

  return { teams, loading, selectedId, selectedTeam, selectTeam };
}
