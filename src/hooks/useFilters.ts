"use client";
import { useState, useEffect, useCallback } from "react";
import { useTeams } from "./useTeam";
import { format } from "date-fns";

const STORAGE_KEY = "checkup_filters";

interface FiltersState {
  teamId: string;
  startDate: string;
  endDate: string;
}

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function loadFromStorage(): Partial<FiltersState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(state: FiltersState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function useFilters() {
  const { teams, loading } = useTeams();
  const [filters, setFilters] = useState<FiltersState>(() => {
    const saved = loadFromStorage();
    const today = todayStr();
    return {
      teamId: saved.teamId ?? "",
      startDate: saved.startDate ?? today,
      endDate: saved.endDate ?? today,
    };
  });

  // Auto-seleciona equipe "desenvolvimento" por padrão; fallback para primeiro ativo
  useEffect(() => {
    if (!loading && teams.length > 0 && !filters.teamId) {
      const devTeam = teams.find(
        (t) => t.isActive && t.teamName.toLowerCase().includes("desenvolvimento")
      );
      const fallback = teams.find((t) => t.isActive) ?? teams[0];
      const selected = (devTeam ?? fallback).id;
      setFilters((prev) => {
        const next = { ...prev, teamId: selected };
        saveToStorage(next);
        return next;
      });
    }
  }, [loading, teams, filters.teamId]);

  const selectTeam = useCallback((id: string) => {
    setFilters((prev) => {
      const next = { ...prev, teamId: id };
      saveToStorage(next);
      return next;
    });
  }, []);

  const setStartDate = useCallback((date: string) => {
    setFilters((prev) => {
      const next = { ...prev, startDate: date };
      saveToStorage(next);
      return next;
    });
  }, []);

  const setEndDate = useCallback((date: string) => {
    setFilters((prev) => {
      const next = { ...prev, endDate: date };
      saveToStorage(next);
      return next;
    });
  }, []);

  const setToday = useCallback(() => {
    const today = todayStr();
    setFilters((prev) => {
      const next = { ...prev, startDate: today, endDate: today };
      saveToStorage(next);
      return next;
    });
  }, []);

  const selectedTeam = teams.find((t) => t.id === filters.teamId) ?? null;

  return {
    teams,
    loading,
    selectedTeam,
    selectedId: filters.teamId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    selectTeam,
    setStartDate,
    setEndDate,
    setToday,
  };
}
