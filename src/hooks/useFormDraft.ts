"use client";

/**
 * Hook para auto-save de formularios en IndexedDB.
 *
 * Patrón replicado de agroflow-platform/src/hooks/useFormDraft.ts:
 *   - `save(data)`: persiste con debounce (default 2s) para evitar writes excesivos
 *   - `saveImmediate(data)`: persiste sin debounce (ej. antes de navegar)
 *   - `load()`: lee el draft guardado
 *   - `clear()`: borra el draft (típicamente después de un save final exitoso)
 *
 * Cleanup del timer al unmount evita writes huérfanos.
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { saveDraft, getDraft, deleteDraft } from "@/lib/offline/db";

interface UseFormDraftOptions {
  key: string; // ej "pp-session" — único por tipo de form
  formType: string;
  debounceMs?: number;
}

export function useFormDraft({ key, formType, debounceMs = 2000 }: UseFormDraftOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const save = useCallback(
    (data: unknown) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          await saveDraft({ key, formType, data, savedAt: Date.now() });
        } catch (e) {
          console.error("[useFormDraft] save failed", { key, formType, error: e });
        }
      }, debounceMs);
    },
    [key, formType, debounceMs],
  );

  const saveImmediate = useCallback(
    async (data: unknown) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        await saveDraft({ key, formType, data, savedAt: Date.now() });
      } catch (e) {
        console.error("[useFormDraft] saveImmediate failed", { key, formType, error: e });
      }
    },
    [key, formType],
  );

  const load = useCallback(async () => {
    try {
      const draft = await getDraft(key);
      return draft?.data ?? null;
    } catch {
      return null;
    }
  }, [key]);

  const clear = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await deleteDraft(key);
    } catch {
      // ignore
    }
  }, [key]);

  // Objeto ESTABLE entre renders: los efectos que dependen de `draft` no deben
  // re-dispararse por identidad (bug 27/07: el restore re-corría en cada render
  // y pisaba cada tecla del usuario con el draft guardado).
  return useMemo(
    () => ({ save, saveImmediate, load, clear }),
    [save, saveImmediate, load, clear],
  );
}
