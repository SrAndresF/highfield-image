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

    let contentType = file.type;
    if (!contentType) {
      if (file.name.endsWith('.mp4')) contentType = 'video/mp4';
      else if (file.name.endsWith('.mov')) contentType = 'video/quicktime';
      else if (file.name.endsWith('.png')) contentType = 'image/png';
      else if (file.name.endsWith('.webp')) contentType = 'image/webp';
      else contentType = fileIsVideo ? 'video/mp4' : 'image/jpeg';
    }
    if (contentType === 'image/jpg') contentType = 'image/jpeg';
    if (contentType === 'video/quicktime') contentType = 'video/mp4';

    onStatusUpdate?.(
      fileIsVideo
        ? 'Generando enlace de subida segura para video...'
        : 'Generando enlace de subida...'
    );

    // 1. INTENTO PRINCIPAL: Subida directa presignada a S3 (sin pasar bytes por Vercel)
    let presignOk = false;
    try {
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hf-credentials': credentials,
        },
        body: JSON.stringify({
          contentType,
          filename: file.name,
          mediaKind: fileIsVideo ? 'video' : 'image',
          fileSize: file.size,
        }),
      });

      if (presignRes.ok) {
        const presignData = (await presignRes.json()) as {
          uploadUrl?: string;
          publicUrl?: string;
          contentType?: string;
          slotId?: string;
        };

        if (presignData.uploadUrl && presignData.publicUrl) {
          presignOk = true;
          onStatusUpdate?.(
            fileIsVideo
              ? `Subiendo video (${(file.size / (1024 * 1024)).toFixed(1)} MB) a Higgsfield CDN...`
              : 'Subiendo archivo a Higgsfield CDN...'
          );

          const s3PutRes = await fetch(presignData.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': presignData.contentType || contentType,
            },
            body: file,
          });

          if (!s3PutRes.ok) {
            throw new Error(
              `Error al transferir datos a Higgsfield Storage (${s3PutRes.status} ${s3PutRes.statusText}).`
            );
          }

          // Si requiere confirmación de slot de agente
          if (presignData.slotId) {
            try {
              await fetch('/api/upload/confirm', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-hf-credentials': credentials,
                },
                body: JSON.stringify({
                  slotId: presignData.slotId,
                  mediaKind: fileIsVideo ? 'video' : 'image',
                }),
              });
            } catch {
              // no crítico
            }
          }

          return presignData.publicUrl;
        }
      } else {
        const errJson = (await presignRes.json().catch(() => ({}))) as {
          error?: string;
        };
        // Si el archivo supera 4 MB y presign falló, no podemos usar el fallback de Vercel
        if (file.size > 4 * 1024 * 1024 && errJson.error) {
          throw new Error(errJson.error);
        }
      }
    } catch (err) {
      if (presignOk) {
        throw err;
      }
      if (file.size > 4.2 * 1024 * 1024) {
        throw new Error(
          `El archivo pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB (supera los 4.5 MB del servidor) y no se pudo obtener enlace directo. Verifica tu API Key o ingresa la URL en "Enlace URL".`
        );
      }
    }

    // 2. FALLBACK PARA ARCHIVOS PEQUEÑOS (<= 4 MB) a través de /api/upload
    if (file.size <= 4.2 * 1024 * 1024) {
      onStatusUpdate?.('Subiendo a través del servidor...');
      const formData = new FormData();
      formData.append('file', file);

      const fallbackRes = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-hf-credentials': credentials,
        },
        body: formData,
      });

      const data = (await fallbackRes.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (fallbackRes.ok && data.url) {
        return data.url;
      }

      throw new Error(
        data.error ?? 'No fue posible subir el archivo al almacenamiento.'
      );
    }

    throw new Error(
      'No fue posible subir el archivo. Intenta ingresar una URL directa.'
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
                    src={url}
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
                  src={currentUrls[0]}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentUrls[0]}
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
                    ? 'Formatos: MP4, MOV, WebM (duración mín. 4s, máx. 30s. Subida directa a S3 sin restricciones de tamaño)'
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
