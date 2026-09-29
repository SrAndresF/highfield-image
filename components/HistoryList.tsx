'use client';

import React from 'react';
import {
  History,
  RotateCcw,
  Trash2,
  Film,
  Image as ImageIcon,
  Eye,
  Shield,
} from 'lucide-react';
import type { HistoryEntry } from '@/hooks/useHistory';

interface HistoryListProps {
  items: HistoryEntry[];
  keyHash: string | null;
  onReuseEntry: (entry: HistoryEntry) => void;
  onSelectPreview: (entry: HistoryEntry) => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
}

export function HistoryList({
  items,
  keyHash,
  onReuseEntry,
  onSelectPreview,
  onDeleteEntry,
  onClearAll,
}: HistoryListProps) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <History className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                Historial Personal en este Navegador
              </h2>
              {keyHash && (
                <span
                  title="Tu historial se aísla usando un hash SHA-256 irreversible de tu API Key. La clave jamás se guarda en el historial."
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800"
                >
                  <Shield className="h-3 w-3 text-emerald-600" />
                  SHA-256: {keyHash.slice(0, 10)}…
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-600">
              Separado automáticamente por usuario mediante huella criptográfica
              SHA-256 de tu API Key.
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Vaciar mi historial ({items.length})
          </button>
        )}
      </div>

      {!keyHash ? (
        <div className="py-10 text-center text-xs font-medium text-slate-600">
          Configura tu API Key para ver y guardar tu historial individual en este
          navegador.
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-xs font-medium text-slate-600">
          Aún no tienes generaciones guardadas con esta API Key. Tus creaciones
          aparecerán aquí automáticamente.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((entry) => {
            const dateFormatted = new Date(entry.createdAt).toLocaleString(
              'es-ES',
              {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              }
            );

            return (
              <div
                key={entry.id}
                className="group flex flex-col justify-between rounded-xl border border-slate-300 bg-slate-50 p-3.5 transition hover:border-indigo-400 hover:bg-white"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                      {entry.mediaType === 'video' ? (
                        <Film className="h-3 w-3" />
                      ) : (
                        <ImageIcon className="h-3 w-3" />
                      )}
                      {entry.modelName}
                    </span>
                    <span className="text-[11px] font-medium text-slate-600">
                      {dateFormatted}
                    </span>
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-xs font-medium leading-relaxed text-slate-900">
                    {entry.prompt}
                  </p>

                  {/* Resumen compacto de parámetros */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(entry.params)
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700"
                        >
                          {k}: {String(v)}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between gap-1.5 border-t border-slate-200 pt-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectPreview(entry)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 transition hover:bg-slate-100"
                    >
                      <Eye className="h-3.5 w-3.5 text-indigo-600" />
                      Ver
                    </button>

                    <button
                      type="button"
                      onClick={() => onReuseEntry(entry)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reutilizar prompt
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteEntry(entry.id)}
                    title="Eliminar del historial"
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-100 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
