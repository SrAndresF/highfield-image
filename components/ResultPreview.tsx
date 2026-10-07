'use client';

import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  XCircle,
  Sparkles,
  Clock,
  Film,
  Image as ImageIcon,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import type { ActiveGenerationResult, JobPhase } from '@/hooks/usePolling';

interface ResultPreviewProps {
  phase: JobPhase;
  requestId: string | null;
  elapsedSeconds: number;
  errorMessage: string | null;
  activeResult: ActiveGenerationResult | null;
  isCanceling: boolean;
  onCancel: () => void;
  onRetry?: () => void;
}

export function ResultPreview({
  phase,
  requestId,
  elapsedSeconds,
  errorMessage,
  activeResult,
  isCanceling,
  onCancel,
  onRetry,
}: ResultPreviewProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const isRunning =
    phase === 'submitting' || phase === 'queued' || phase === 'in_progress';

  const currentMediaUrl =
    activeResult?.mediaType === 'image' &&
    activeResult.images.length > selectedImageIndex
      ? activeResult.images[selectedImageIndex] ?? activeResult.resultUrl
      : activeResult?.resultUrl ?? '';

  const handleCopyUrl = async () => {
    if (!currentMediaUrl) return;
    try {
      await navigator.clipboard.writeText(currentMediaUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownload = async () => {
    if (!currentMediaUrl) return;
    setIsDownloading(true);
    try {
      const response = await fetch(currentMediaUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const ext = activeResult?.mediaType === 'video' ? 'mp4' : 'png';
      link.href = blobUrl;
      link.download = `higgsfield-${activeResult?.requestId.slice(0, 8) ?? Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(currentMediaUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatElapsed = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-300 bg-white p-5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
        <div className="flex items-center gap-2">
          {activeResult?.mediaType === 'video' ? (
            <Film className="h-4 w-4 text-indigo-600" />
          ) : (
            <ImageIcon className="h-4 w-4 text-indigo-600" />
          )}
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
            Lienzo de Resultado
          </h2>
        </div>

        {requestId && (
          <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
            Job ID: {requestId.slice(0, 12)}…
          </span>
        )}
      </div>

      {/* Estado en ejecución / polling */}
      {isRunning && (
        <div className="my-auto flex flex-col items-center justify-center py-14 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>

          <h3 className="mt-5 text-base font-extrabold text-slate-900">
            {phase === 'submitting' && 'Enviando solicitud a Higgsfield API...'}
            {phase === 'queued' && 'Trabajo en cola de procesamiento...'}
            {phase === 'in_progress' && 'Generando contenido con IA...'}
          </h3>

          <p className="mt-1.5 max-w-sm text-xs font-medium leading-relaxed text-slate-600">
            {phase === 'queued'
              ? 'Tu tarea ha sido aceptada por el clúster GPU y comenzará en breve.'
              : 'Renderizando fotogramas de alta calidad. Los videos pueden tardar entre 30 segundos y 3 minutos.'}
          </p>

          {/* Barra de progreso visual y cronómetro */}
          <div className="mt-5 w-full max-w-xs space-y-2">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full bg-indigo-600 transition-all duration-500 ${
                  phase === 'submitting'
                    ? 'w-1/5 animate-pulse'
                    : phase === 'queued'
                    ? 'w-2/5 animate-pulse'
                    : 'w-4/5 animate-pulse'
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                Tiempo transcurrido: {formatElapsed(elapsedSeconds)}
              </span>
              <span className="font-bold text-indigo-700">
                {phase === 'queued' ? 'En cola' : 'Procesando'}
              </span>
            </div>
          </div>

          {/* Botón Cancelar */}
          {requestId && (
            <button
              type="button"
              disabled={isCanceling}
              onClick={onCancel}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              {isCanceling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {isCanceling ? 'Cancelando...' : 'Cancelar generación'}
            </button>
          )}
        </div>
      )}

      {/* Estado de error o cancelación */}
      {!isRunning &&
        (phase === 'failed' || phase === 'nsfw' || phase === 'canceled') && (
          <div className="my-auto flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-xs">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-extrabold text-slate-900">
              {phase === 'canceled'
                ? 'Generación cancelada'
                : phase === 'nsfw'
                ? 'Bloqueado por filtro de moderación (NSFW)'
                : 'No se pudo completar la generación'}
            </h3>

            <div className="mt-3.5 w-full max-w-md space-y-3">
              <p className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs font-semibold leading-relaxed text-rose-900">
                {errorMessage ??
                  'Ocurrió un error inesperado al procesar el trabajo en Higgsfield.'}
              </p>

              {/* Alerta explicativa y botón de recarga si es error de saldo/créditos de la API */}
              {(errorMessage?.toLowerCase().includes('saldo') ||
                errorMessage?.toLowerCase().includes('credit') ||
                errorMessage?.toLowerCase().includes('balance')) && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-left text-xs text-amber-900 shadow-2xs">
                  <p className="font-extrabold text-amber-950 flex items-center gap-1.5">
                    <span>💳</span>
                    <span>¿Por qué ocurre esto si tienes créditos en Higgsfield?</span>
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-amber-900">
                    Higgsfield separa su <strong>suscripción web</strong> (higgsfield.ai con créditos de usuario) de su <strong>API de Desarrolladores</strong> (open.higgsfield.ai con saldo en USD prepagado).
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-900">
                    Tu API Key consume directamente del <strong>saldo prepagado en USD</strong> de tu consola de desarrollador.
                  </p>
                  <a
                    href="https://open.higgsfield.ai/billing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700"
                  >
                    <span>Recargar saldo en open.higgsfield.ai/billing</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

              {/* Botón prominente de reintento */}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Reintentar generación</span>
                </button>
              )}

              {/* Guía de solución de problemas para video */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs text-slate-700 shadow-2xs">
                <p className="font-extrabold text-slate-900">💡 Sugerencias para video:</p>
                <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-[11px] text-slate-600">
                  <li>
                    <strong>Créditos protegidos:</strong> Higgsfield reembolsa automáticamente los créditos de cualquier generación fallida.
                  </li>
                  <li>
                    <strong>Formato del video:</strong> En Genjutsu, el video debe durar entre 4 y 30 segundos y estar en MP4/WebM.
                  </li>
                  <li>
                    <strong>Prueba sin audio:</strong> En Seedance, desactivar &ldquo;Generar audio sincronizado&rdquo; suele evitar fallos si el motor de sonido está saturado.
                  </li>
                  <li>
                    <strong>Sobrecarga temporal:</strong> Los clústeres GPU de Higgsfield pueden saturarse brevemente; reintentar unos segundos después suele resolverlo.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

      {/* Estado inicial vacío */}
      {!isRunning &&
        phase !== 'failed' &&
        phase !== 'nsfw' &&
        phase !== 'canceled' &&
        !activeResult && (
          <div className="my-auto flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-300 bg-slate-100 text-indigo-600">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-slate-900">
              Ningún resultado en pantalla
            </h3>
            <p className="mt-1 max-w-sm text-xs font-medium leading-relaxed text-slate-600">
              Elige un modelo de imagen o video, redacta tu prompt y presiona{' '}
              <strong className="text-slate-900">Generar</strong> para visualizar
              y descargar el contenido aquí.
            </p>
          </div>
        )}

      {/* Vista previa del resultado completado */}
      {!isRunning && activeResult && (
        <div className="mt-4 flex flex-1 flex-col justify-between space-y-4">
          {/* Contenedor multimedia */}
          <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-900">
            {activeResult.mediaType === 'video' ? (
              <video
                key={currentMediaUrl}
                src={currentMediaUrl}
                controls
                autoPlay
                loop
                playsInline
                className="mx-auto max-h-[480px] w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentMediaUrl}
                alt={activeResult.prompt}
                className="mx-auto max-h-[480px] w-full object-contain"
              />
            )}
          </div>

          {/* Selector de miniaturas cuando el modelo devuelve lote de varias imágenes */}
          {activeResult.mediaType === 'image' &&
            activeResult.images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {activeResult.images.map((imgUrl, idx) => (
                  <button
                    key={imgUrl}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      selectedImageIndex === idx
                        ? 'border-indigo-600'
                        : 'border-slate-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={`Variante ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

          {/* Aviso importante sobre expiración de URLs y botones prominentes de descarga */}
          <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="inline-block rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-800">
                  {activeResult.modelName}
                </span>
                <p className="mt-1 truncate text-xs font-medium text-slate-800">
                  &ldquo;{activeResult.prompt}&rdquo;
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Los enlaces CDN temporales de Higgsfield pueden expirar tras
                cierto tiempo. <strong>Descarga tu archivo ahora</strong> para
                conservarlo permanentemente.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 sm:text-sm"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Descargar {activeResult.mediaType === 'video' ? 'Video MP4' : 'Imagen'}
              </button>

              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-100"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-700">¡Enlace copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copiar enlace</span>
                  </>
                )}
              </button>

              <a
                href={currentMediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir URL directa en nueva pestaña"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white p-2.5 text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
