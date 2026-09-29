'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MediaType, ParameterValue } from '@/lib/models';

export interface HistoryEntry {
  id: string;
  requestId: string;
  prompt: string;
  modelId: string;
  modelName: string;
  mediaType: MediaType;
  params: Record<string, ParameterValue>;
  resultUrl: string;
  images: string[];
  videoUrl: string | null;
  createdAt: string;
}

const HISTORY_STORAGE_PREFIX = 'hf_studio_history_sha256_';
const MAX_HISTORY_ITEMS = 50;

export function useHistory(keyHash: string | null) {
  const [items, setItems] = useState<HistoryEntry[]>([]);

  const storageKey = keyHash ? `${HISTORY_STORAGE_PREFIX}${keyHash}` : null;

  useEffect(() => {
    if (!storageKey) {
      setItems([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setItems([]);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setItems(parsed as HistoryEntry[]);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
  }, [storageKey]);

  const addHistoryEntry = useCallback(
    (entry: Omit<HistoryEntry, 'id'>) => {
      if (!storageKey) return;
      const newEntry: HistoryEntry = {
        ...entry,
        id: `${entry.requestId}_${Date.now()}`,
      };
      setItems((prev) => {
        const filtered = prev.filter((item) => item.requestId !== entry.requestId);
        const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // ignore quota errors
        }
        return updated;
      });
    },
    [storageKey]
  );

  const removeHistoryEntry = useCallback(
    (id: string) => {
      if (!storageKey) return;
      setItems((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    },
    [storageKey]
  );

  const clearHistoryForCurrentUser = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setItems([]);
  }, [storageKey]);

  return {
    items,
    addHistoryEntry,
    removeHistoryEntry,
    clearHistoryForCurrentUser,
  };
}
