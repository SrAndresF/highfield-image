'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Loader2,
  X,
  Link as LinkIcon,
  Image as ImageIcon,
  Film,
  CheckCircle2,
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
}: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [dragOver, setDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!credentials) {
      setUploadError(
        'Debes configurar tu API Key de Higgsfield antes de poder subir archivos.'
      );
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-hf-credentials': credentials,
        },
        body: formData,
      });

      const data = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !data.url) {
        setUploadError(
          data.error ?? 'Error al subir el archivo al almacenamiento de Higgsfield.'
        );
        return;
      }

      onChange(data.url);
    } catch {
      setUploadError('Error de red al intentar subir el archivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        void handleFileUpload(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile) {
        void handleFileUpload(selectedFile);
      }
    }
  };

  const isVideo = mediaKind === 'video' || value.endsWith('.mp4');

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
              onClick={() => onChange(sampleUrl)}
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

      {/* Si ya hay un valor cargado, mostrar vista previa */}
      {value ? (
        <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-900">
            {isVideo ? (
              <video
                src={value.split(',')[0]?.trim()}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value.split(',')[0]?.trim()}
                alt="Vista previa"
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {mediaKind === 'video'
                  ? 'Video de referencia cargado'
                  : value.includes(',')
                  ? `${value.split(',').filter((u) => u.trim()).length} imágenes de referencia cargadas`
                  : 'Imagen de referencia cargada'}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-slate-600">
              {value}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onChange('')}
            title="Quitar medio"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-100 hover:text-rose-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : mode === 'upload' ? (
        /* Zona de arrastrar y soltar archivo */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition ${
            dragOver
              ? 'border-indigo-600 bg-indigo-50'
              : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={
              mediaKind === 'video'
                ? 'video/mp4,video/quicktime,video/webm'
                : 'image/png,image/jpeg,image/webp,image/jpg'
            }
            onChange={handleFileChange}
            className="hidden"
          />

          {isUploading ? (
            <div className="flex flex-col items-center py-2">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <p className="mt-2 text-xs font-bold text-slate-800">
                Subiendo archivo a Higgsfield CDN...
              </p>
            </div>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                {mediaKind === 'video' ? (
                  <Film className="h-5 w-5" />
                ) : (
                  <UploadCloud className="h-5 w-5" />
                )}
              </div>
              <p className="mt-2 text-xs font-bold text-slate-800">
                Haz clic para seleccionar o arrastra tu archivo aquí
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {mediaKind === 'video'
                  ? 'Formatos permitidos: MP4, MOV, WebM (mín. 4s, máx. 30s)'
                  : 'Formatos soportados: JPG, PNG, WebP (alta resolución)'}
              </p>
            </>
          )}
        </div>
      ) : (
        /* Campo para ingresar URL pública directa */
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <LinkIcon className="h-4 w-4" />
          </div>
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              mediaKind === 'video'
                ? 'https://ejemplo.com/mi-video.mp4'
                : 'https://ejemplo.com/mi-imagen.jpg'
            }
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-600"
          />
        </div>
      )}

      {uploadError && (
        <p className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">
          {uploadError}
        </p>
      )}
    </div>
  );
}
