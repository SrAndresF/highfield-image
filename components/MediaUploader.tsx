'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Loader2,
  X,
  Link as LinkIcon,
  Film,
  CheckCircle2,
  Plus,
  Trash2,
} from 'lucide-react';

interface MediaUploaderProps {
  label: string;
  description?: string;
  required?: boolean;
  value: string;
  onChange: (url: string) => void;
  credentials?: string;
  mediaKind?: 'image' | 'video';
  sampleUrl?: string;
  sampleLabel?: string;
  allowMultiple?: boolean;
  maxFiles?: number;
}

export function MediaUploader({
  label,
  description,
  required,
  value,
  onChange,
  credentials,
  mediaKind = 'image',
  sampleUrl,
  sampleLabel,
  allowMultiple = false,
  maxFiles = 8,
}: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [dragOver, setDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsear las URLs existentes desde el string separado por comas
  const currentUrls = value
    ? value
        .split(',')
        .map((u) => u.trim())
        .filter((u) => u.length > 0)
    : [];

  const isVideo = mediaKind === 'video' || (currentUrls[0]?.endsWith('.mp4') ?? false);

  /**
   * Sube un único archivo de imagen o video.
   * Utiliza primero subida directa presignada a S3/Higgsfield para eludir el límite
   * estricto de 4.5 MB de Vercel Serverless (vital para videos de 10-100MB+).
   */
  const uploadSingleFile = async (
    file: File,
    onStatusUpdate?: (status: string) => void
  ): Promise<string> => {
    if (!credentials) {
      throw new Error(
        'Debes configurar tu API Key de Higgsfield antes de poder subir archivos.'
      );
    }

    const fileIsVideo =
      mediaKind === 'video' ||
      file.type.startsWith('video/') ||
      /\.(mp4|mov|webm)$/i.test(file.name);

    onStatusUpdate?.(
      fileIsVideo
        ? `Subiendo video (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`
        : 'Subiendo imagen...'
    );

    const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);

    // 1. INTENTO PRINCIPAL: Subida directa en la nube con soporte nativo de CORS (tmpfiles.org)
    // Permite archivos de hasta 10 GB sin el límite de 4.5 MB de Vercel y sin bloqueos de ad-blockers.
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);

      const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const json = (await res.json()) as {
          status?: string;
          data?: { url?: string };
        };

        if (json?.status === 'success' && json?.data?.url) {
          const rawUrl = json.data.url;
          onStatusUpdate?.('Generando enlace de transmisión...');

          // Resolver enlace de descarga directa para reproducción instantánea y envío al modelo
          try {
            const resolveRes = await fetch('/api/upload/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: rawUrl }),
            });

            if (resolveRes.ok) {
              const resolveJson = (await resolveRes.json()) as { url?: string };
              if (resolveJson.url) {
                return resolveJson.url;
              }
            }
          } catch {
            // Si la resolución auxiliar falla, retornar rawUrl (el proxy de medios lo resolverá)
          }
          return rawUrl;
        }
      }
    } catch {
      // Si la subida directa falla en el cliente (p. ej. fallo temporal de red), continuar al fallback
    }

    // 2. FALLBACK A TRAVÉS DEL SERVIDOR (para archivos <= 4.2 MB)
    if (file.size <= 4.2 * 1024 * 1024) {
      onStatusUpdate?.('Subiendo a través del servidor...');
      try {
        const formData = new FormData();
        formData.append('file', file);

        const serverRes = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'x-hf-credentials': credentials,
          },
          body: formData,
        });

        const data = (await serverRes.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };

        if (serverRes.ok && data.url) {
          return data.url;
        }
        if (data.error) {
          throw new Error(data.error);
        }
      } catch (err) {
        if (err instanceof Error) throw err;
      }
    }

    // 3. Fallback adicional si el archivo supera 4.2 MB y la subida directa falló
    if (file.size > 4.2 * 1024 * 1024) {
      throw new Error(
        `El archivo pesa ${fileSizeMb} MB. La subida directa encontró una interrupción de red. Puedes intentar de nuevo o ingresar un enlace público en la pestaña "Enlace URL".`
      );
    }

    throw new Error(
      'No fue posible subir el archivo. Intenta ingresar una URL directa en la pestaña "Enlace URL".'
    );
  };

  /**
   * Procesa la subida de uno o múltiples archivos.
   */
  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!credentials) {
      setUploadError(
        'Debes configurar tu API Key de Higgsfield antes de poder subir archivos.'
      );
      return;
    }

    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      if (allowMultiple) {
        const availableSlots = maxFiles - currentUrls.length;
        if (availableSlots <= 0) {
          setUploadError(
            `Ya alcanzaste el límite máximo de ${maxFiles} imágenes permitidas.`
          );
          setIsUploading(false);
          return;
        }

        const toUpload = fileList.slice(0, availableSlots);
        const uploadedUrls: string[] = [];

        for (let i = 0; i < toUpload.length; i++) {
          const file = toUpload[i];
          if (!file) continue;

          const progressLabel =
            toUpload.length > 1
              ? `Subiendo imagen ${i + 1} de ${toUpload.length}...`
              : 'Subiendo imagen...';
          setUploadProgressText(progressLabel);

          const url = await uploadSingleFile(file, (msg) => {
            setUploadProgressText(
              toUpload.length > 1
                ? `Imagen ${i + 1}/${toUpload.length}: ${msg}`
                : msg
            );
          });
          uploadedUrls.push(url);
        }

        const combined = [...currentUrls, ...uploadedUrls];
        onChange(combined.join(', '));
      } else {
        // Subida de un único archivo (video o imagen)
        const file = fileList[0];
        if (!file) return;

        setUploadProgressText(
          file.type.startsWith('video/') || mediaKind === 'video'
            ? 'Preparando subida de video...'
            : 'Subiendo archivo...'
        );

        const url = await uploadSingleFile(file, setUploadProgressText);
        onChange(url);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error inesperado al intentar subir el archivo.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFilesUpload(e.target.files);
    }
  };

  const removeUrlAtIndex = (indexToRemove: number) => {
    const updated = currentUrls.filter((_, idx) => idx !== indexToRemove);
    onChange(updated.join(', '));
  };

  const clearAllUrls = () => {
    onChange('');
  };

  return (
    <div className="sm:col-span-2 space-y-2 rounded-xl border border-slate-300 bg-white p-3.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-bold text-slate-900">
            {label} {required && <span className="text-rose-600">*</span>}
          </label>
          {description && (
            <p className="mt-0.5 text-xs text-slate-600">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {sampleUrl && (
            <button
              type="button"
              onClick={() => {
                if (allowMultiple) {
                  const combined = currentUrls.includes(sampleUrl)
                    ? currentUrls
                    : [...currentUrls, sampleUrl].slice(0, maxFiles);
                  onChange(combined.join(', '));
                } else {
                  onChange(sampleUrl);
                }
              }}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              {sampleLabel ?? 'Usar ejemplo de prueba'}
            </button>
          )}

          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`rounded-md px-2 py-1 transition ${
                mode === 'upload'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Subir archivo
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`rounded-md px-2 py-1 transition ${
                mode === 'url'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Enlace URL
            </button>
          </div>
        </div>
      </div>

      {/* Input oculto para selección de archivos */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={allowMultiple}
        accept={
          mediaKind === 'video'
            ? 'video/mp4,video/quicktime,video/webm,video/x-m4v'
            : 'image/png,image/jpeg,image/webp,image/jpg'
        }
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ==================================================================== */}
      {/* VISTA PREVIA: MÚLTIPLES IMÁGENES (GENJUTSU / MULTI-REF)              */}
      {/* ==================================================================== */}
      {allowMultiple && currentUrls.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>
                {currentUrls.length} de {maxFiles} imágenes de referencia cargadas
              </span>
            </div>

            <div className="flex items-center gap-2">
              {currentUrls.length < maxFiles && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Agregar otra</span>
                </button>
              )}
              <button
                type="button"
                onClick={clearAllUrls}
                title="Quitar todas las imágenes"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-rose-600 transition hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Limpiar todas</span>
              </button>
            </div>
          </div>

          {/* Galería de imágenes cargadas */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {currentUrls.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className="group relative overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xs"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      url.includes('tmpfiles.org')
                        ? `/api/media?url=${encodeURIComponent(url)}`
                        : url
                    }
                    alt={`Referencia ${idx + 1}`}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <span className="absolute left-1.5 top-1.5 rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur-xs">
                    #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeUrlAtIndex(idx)}
                    title={`Quitar imagen #${idx + 1}`}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition hover:bg-rose-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-1 text-center">
                  <p className="truncate font-mono text-[10px] text-slate-500">
                    {url.split('/').pop() || `imagen-${idx + 1}`}
                  </p>
                </div>
              </div>
            ))}

            {/* Ranura para agregar más si aún no se llega al tope */}
            {currentUrls.length < maxFiles && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-2 text-center text-indigo-700 transition hover:border-indigo-500 hover:bg-indigo-50"
              >
                <Plus className="h-6 w-6" />
                <span className="mt-1 text-[11px] font-bold">
                  + Agregar #{currentUrls.length + 1}
                </span>
                <span className="text-[10px] text-slate-500">
                  (hasta {maxFiles})
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VISTA PREVIA: UN ÚNICO ARCHIVO (IMAGEN O VIDEO)                      */}
      {/* ==================================================================== */}
      {!allowMultiple && currentUrls.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-50 p-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>
                {isVideo
                  ? 'Video de referencia listo para procesar'
                  : 'Imagen de referencia cargada'}
              </span>
            </div>

            <button
              type="button"
              onClick={clearAllUrls}
              title="Quitar archivo"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-rose-600 transition hover:bg-rose-100"
            >
              <X className="h-4 w-4" />
              <span>Eliminar</span>
            </button>
          </div>

          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
            {isVideo ? (
              <div className="relative max-h-48 w-full overflow-hidden rounded-lg border border-slate-300 bg-black sm:w-64">
                <video
                  src={
                    currentUrls[0].includes('tmpfiles.org')
                      ? `/api/media?url=${encodeURIComponent(currentUrls[0])}`
                      : currentUrls[0]
                  }
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    currentUrls[0].includes('tmpfiles.org')
                      ? `/api/media?url=${encodeURIComponent(currentUrls[0])}`
                      : currentUrls[0]
                  }
                  alt="Vista previa"
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="break-all font-mono text-[11px] text-slate-700">
                {currentUrls[0]}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1.5 text-xs font-bold text-indigo-600 hover:underline"
              >
                Reemplazar con otro archivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ZONA DE CARGA O INGRESO DE URL CUANDO SE NECESITA                    */}
      {/* ==================================================================== */}
      {mode === 'upload' ? (
        // Mostrar dropzone si no hay archivos o si se permite agregar más
        (!allowMultiple || currentUrls.length === 0) && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (!isUploading) fileInputRef.current?.click();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition ${
              dragOver
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100'
            }`}
          >
            {isUploading ? (
              <div className="flex flex-col items-center py-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="mt-2 text-xs font-bold text-slate-900">
                  {uploadProgressText || 'Subiendo archivo a Higgsfield CDN...'}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Subida directa optimizada (sin límite de 4.5 MB)
                </p>
              </div>
            ) : (
              <>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shadow-xs">
                  {mediaKind === 'video' ? (
                    <Film className="h-6 w-6" />
                  ) : (
                    <UploadCloud className="h-6 w-6" />
                  )}
                </div>
                <p className="mt-2.5 text-xs font-bold text-slate-900">
                  {allowMultiple
                    ? 'Haz clic para seleccionar o arrastra tus imágenes aquí'
                    : mediaKind === 'video'
                    ? 'Haz clic para seleccionar tu video o arrástralo aquí'
                    : 'Haz clic para seleccionar tu imagen o arrástrala aquí'}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  {mediaKind === 'video'
                    ? 'Formatos: MP4, MOV, WebM (duración mín. 4s, máx. 30s. Subida directa en la nube sin restricciones de tamaño)'
                    : allowMultiple
                    ? `Puedes seleccionar de 1 a ${maxFiles} imágenes JPG, PNG o WebP a la vez`
                    : 'Formatos soportados: JPG, PNG, WebP (alta resolución)'}
                </p>
              </>
            )}
          </div>
        )
      ) : (
        /* Modo Enlace URL */
        <div className="space-y-1.5">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <LinkIcon className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={
                allowMultiple
                  ? 'https://ejemplo.com/ref1.jpg, https://ejemplo.com/ref2.jpg'
                  : mediaKind === 'video'
                  ? 'https://ejemplo.com/mi-video.mp4'
                  : 'https://ejemplo.com/mi-imagen.jpg'
              }
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-600"
            />
          </div>
          {allowMultiple && (
            <p className="text-[11px] text-slate-500">
              Para múltiples imágenes de referencia, separa los enlaces HTTPS con comas (hasta {maxFiles} URLs).
            </p>
          )}
        </div>
      )}

      {/* Mensaje de error visible y claro */}
      {uploadError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div className="flex-1">
            <p className="font-semibold">{uploadError}</p>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-600 hover:text-rose-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
