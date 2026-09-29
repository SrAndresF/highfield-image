'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MediaType, ParameterValue } from '@/lib/models';

export type JobPhase =
  | 'idle'
  | 'submitting'
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'nsfw'
  | 'canceled';

export interface ActiveGenerationResult {
  requestId: string;
  modelId: string;
  modelName: string;
  mediaType: MediaType;
  prompt: string;
  params: Record<string, ParameterValue>;
  resultUrl: string;
  images: string[];
  videoUrl: string | null;
  completedAt: string;
}

interface StartJobArgs {
  credentials: string;
  modelId: string;
  modelName: string;
  mediaType: MediaType;
  prompt: string;
  params: Record<string, ParameterValue>;
  onCompleted?: (result: ActiveGenerationResult) => void;
}

export interface UsePollingReturn {
  phase: JobPhase;
  requestId: string | null;
  elapsedSeconds: number;
  errorMessage: string | null;
  activeResult: ActiveGenerationResult | null;
  isCanceling: boolean;
  startGeneration: (args: StartJobArgs) => Promise<void>;
  cancelGeneration: (credentials: string) => Promise<void>;
  selectResultFromHistory: (result: ActiveGenerationResult) => void;
  resetJobState: () => void;
}

const POLL_INTERVAL_MS = 3000;

export function usePolling(): UsePollingReturn {
  const [phase, setPhase] = useState<JobPhase>('idle');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeResult, setActiveResult] =
    useState<ActiveGenerationResult | null>(null);
  const [isCanceling, setIsCanceling] = useState<boolean>(false);

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeJobContextRef = useRef<StartJobArgs | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const clearTimers = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const pollOnce = useCallback(
    async (jobId: string, jobContext: StartJobArgs) => {
      if (!isMountedRef.current) return;

      try {
        const response = await fetch(
          `/api/status/${encodeURIComponent(jobId)}`,
          {
            method: 'GET',
            headers: {
              'x-hf-credentials': jobContext.credentials,
            },
            cache: 'no-store',
          }
        );

        const data = (await response.json()) as {
          requestId?: string;
          status?: JobPhase;
          resultUrl?: string | null;
          images?: string[];
          videoUrl?: string | null;
          errorMessage?: string;
          error?: string;
        };

        if (!response.ok) {
          clearTimers();
          setPhase('failed');
          setErrorMessage(
            data.error ??
              'Error al consultar el estado de la generación en Higgsfield.'
          );
          return;
        }

        const currentStatus = data.status ?? 'queued';

        if (currentStatus === 'completed') {
          clearTimers();
          const finalUrl =
            data.resultUrl ??
            data.videoUrl ??
            (Array.isArray(data.images) && data.images.length > 0
              ? data.images[0]
              : null);

          if (!finalUrl) {
            setPhase('failed');
            setErrorMessage(
              'El trabajo finalizó como completado, pero no se recibió ninguna URL de medio.'
            );
            return;
          }

          const completedData: ActiveGenerationResult = {
            requestId: jobId,
            modelId: jobContext.modelId,
            modelName: jobContext.modelName,
            mediaType: jobContext.mediaType,
            prompt: jobContext.prompt,
            params: jobContext.params,
            resultUrl: finalUrl,
            images: Array.isArray(data.images) ? data.images : [],
            videoUrl: data.videoUrl ?? null,
            completedAt: new Date().toISOString(),
          };

          setActiveResult(completedData);
          setPhase('completed');
          if (jobContext.onCompleted) {
            jobContext.onCompleted(completedData);
          }
          return;
        }

        if (
          currentStatus === 'failed' ||
          currentStatus === 'nsfw' ||
          currentStatus === 'canceled'
        ) {
          clearTimers();
          setPhase(currentStatus);
          setErrorMessage(
            data.errorMessage ??
              (currentStatus === 'nsfw'
                ? 'El contenido fue bloqueado por el filtro de seguridad (NSFW).'
                : currentStatus === 'canceled'
                ? 'La generación fue cancelada.'
                : 'La generación falló en Higgsfield API.')
          );
          return;
        }

        setPhase(currentStatus === 'in_progress' ? 'in_progress' : 'queued');
        pollTimeoutRef.current = setTimeout(() => {
          void pollOnce(jobId, jobContext);
        }, POLL_INTERVAL_MS);
      } catch {
        // Si hay un fallo momentáneo de red local, reintentamos en el siguiente ciclo
        pollTimeoutRef.current = setTimeout(() => {
          void pollOnce(jobId, jobContext);
        }, POLL_INTERVAL_MS + 1000);
      }
    },
    [clearTimers]
  );

  const startGeneration = useCallback(
    async (args: StartJobArgs) => {
      clearTimers();
      setErrorMessage(null);
      setIsCanceling(false);
      setElapsedSeconds(0);
      setRequestId(null);
      setPhase('submitting');
      activeJobContextRef.current = args;

      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hf-credentials': args.credentials,
          },
          body: JSON.stringify({
            modelId: args.modelId,
            prompt: args.prompt,
            params: args.params,
          }),
        });

        const data = (await res.json()) as {
          requestId?: string;
          status?: string;
          error?: string;
        };

        if (!res.ok || !data.requestId) {
          clearTimers();
          setPhase('failed');
          setErrorMessage(
            data.error ??
              'No se pudo iniciar la generación. Revisa tus parámetros y tu API Key.'
          );
          return;
        }

        const newJobId = data.requestId;
        setRequestId(newJobId);
        setPhase(data.status === 'in_progress' ? 'in_progress' : 'queued');

        pollTimeoutRef.current = setTimeout(() => {
          void pollOnce(newJobId, args);
        }, 2000);
      } catch {
        clearTimers();
        setPhase('failed');
        setErrorMessage(
          'Error de red al enviar la solicitud al servidor.'
        );
      }
    },
    [clearTimers, pollOnce]
  );

  const cancelGeneration = useCallback(
    async (credentials: string) => {
      if (!requestId || isCanceling) return;
      setIsCanceling(true);
      try {
        const res = await fetch(
          `/api/cancel/${encodeURIComponent(requestId)}`,
          {
            method: 'POST',
            headers: {
              'x-hf-credentials': credentials,
            },
          }
        );
        const data = (await res.json()) as {
          canceled?: boolean;
          message?: string;
          error?: string;
        };
        if (res.ok && data.canceled) {
          clearTimers();
          setPhase('canceled');
          setErrorMessage(
            data.message ?? 'Trabajo cancelado por el usuario.'
          );
        } else {
          setErrorMessage(
            data.message ??
              data.error ??
              'No se pudo cancelar (es posible que ya esté generándose).'
          );
        }
      } catch {
        setErrorMessage('Error al intentar cancelar el trabajo.');
      } finally {
        setIsCanceling(false);
      }
    },
    [requestId, isCanceling, clearTimers]
  );

  const selectResultFromHistory = useCallback(
    (result: ActiveGenerationResult) => {
      clearTimers();
      setErrorMessage(null);
      setRequestId(result.requestId);
      setActiveResult(result);
      setPhase('completed');
    },
    [clearTimers]
  );

  const resetJobState = useCallback(() => {
    clearTimers();
    setPhase('idle');
    setErrorMessage(null);
    setRequestId(null);
    setElapsedSeconds(0);
  }, [clearTimers]);

  return {
    phase,
    requestId,
    elapsedSeconds,
    errorMessage,
    activeResult,
    isCanceling,
    startGeneration,
    cancelGeneration,
    selectResultFromHistory,
    resetJobState,
  };
}
