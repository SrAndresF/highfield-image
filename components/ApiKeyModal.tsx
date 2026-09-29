'use client';

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  X,
  ShieldCheck,
  ExternalLink,
  PlugZap,
} from 'lucide-react';
import type { ConnectionState } from '@/hooks/useApiKey';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKeyId: string;
  currentKeySecret: string;
  currentRemember: boolean;
  hasCredentials: boolean;
  connectionState: ConnectionState;
  connectionMessage: string | null;
  onSaveKey: (
    id: string,
    secret: string,
    remember: boolean
  ) => Promise<{ ok: boolean; message: string }>;
  onTestKey: (
    id: string,
    secret: string
  ) => Promise<{ ok: boolean; message: string }>;
  onClearKey: () => void;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  currentKeyId,
  currentKeySecret,
  currentRemember,
  hasCredentials,
  connectionState,
  connectionMessage,
  onSaveKey,
  onTestKey,
  onClearKey,
}: ApiKeyModalProps) {
  const [keyIdInput, setKeyIdInput] = useState<string>(currentKeyId);
  const [keySecretInput, setKeySecretInput] = useState<string>(currentKeySecret);
  const [remember, setRemember] = useState<boolean>(currentRemember);
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [localFeedback, setLocalFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setKeyIdInput(currentKeyId);
      setKeySecretInput(currentKeySecret);
      setRemember(currentRemember);
      setLocalFeedback(null);
    }
  }, [isOpen, currentKeyId, currentKeySecret, currentRemember]);

  if (!isOpen) return null;

  const handleKeyIdChange = (val: string) => {
    if (val.includes(':')) {
      const [idPart, ...secretParts] = val.split(':');
      setKeyIdInput((idPart ?? '').trim());
      setKeySecretInput(secretParts.join(':').trim());
      return;
    }
    setKeyIdInput(val);
  };

  const handleKeySecretChange = (val: string) => {
    if (!keyIdInput && val.includes(':')) {
      const [idPart, ...secretParts] = val.split(':');
      setKeyIdInput((idPart ?? '').trim());
      setKeySecretInput(secretParts.join(':').trim());
      return;
    }
    setKeySecretInput(val);
  };

  const handleTest = async () => {
    setIsBusy(true);
    setLocalFeedback(null);
    try {
      const res = await onTestKey(keyIdInput, keySecretInput);
      setLocalFeedback({
        type: res.ok ? 'success' : 'error',
        text: res.message,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setLocalFeedback(null);
    try {
      const res = await onSaveKey(keyIdInput, keySecretInput, remember);
      setLocalFeedback({
        type: res.ok ? 'success' : 'error',
        text: res.message,
      });
      if (res.ok) {
        setTimeout(() => {
          onClose();
        }, 700);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogoutClear = () => {
    onClearKey();
    setKeyIdInput('');
    setKeySecretInput('');
    setLocalFeedback({
      type: 'info',
      text: 'Se eliminó tu API Key de localStorage y sessionStorage en este navegador.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Configuración de API Key Personal
              </h2>
              <p className="text-xs font-medium text-slate-600">
                Formato oficial de Higgsfield V2:{' '}
                <code className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-indigo-700">
                  api-key-id:api-key-secret
                </code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {/* Aviso de seguridad */}
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-950">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-bold text-amber-950">
                  Seguridad por usuario (Sin clave global en servidor)
                </p>
                <p className="mt-0.5 text-amber-900">
                  Tu credencial se guarda únicamente en este navegador y nunca se
                  almacena en bases de datos, cookies ni logs del servidor. No
                  actives &ldquo;Recordar en este dispositivo&rdquo; en equipos
                  públicos o compartidos.
                </p>
              </div>
            </div>
          </div>

          {/* Campo Key ID */}
          <div>
            <label
              htmlFor="hf-key-id"
              className="block text-xs font-bold uppercase tracking-wider text-slate-800"
            >
              API Key ID
            </label>
            <p className="mb-1.5 text-xs text-slate-600">
              Puedes pegar directamente el par completo{' '}
              <code className="font-semibold text-slate-900">id:secret</code> y se
              separará automáticamente.
            </p>
            <input
              id="hf-key-id"
              type="text"
              value={keyIdInput}
              onChange={(e) => handleKeyIdChange(e.target.value)}
              placeholder="Ej: 8f9c2a1d-4b3e-..."
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          {/* Campo Key Secret */}
          <div>
            <label
              htmlFor="hf-key-secret"
              className="block text-xs font-bold uppercase tracking-wider text-slate-800"
            >
              API Key Secret
            </label>
            <div className="relative mt-1.5">
              <input
                id="hf-key-secret"
                type={showSecret ? 'text' : 'password'}
                value={keySecretInput}
                onChange={(e) => handleKeySecretChange(e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••"
                autoComplete="new-password"
                spellCheck={false}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-11 font-mono text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
              />
              <button
                type="button"
                onClick={() => setShowSecret((prev) => !prev)}
                title={showSecret ? 'Ocultar Secret' : 'Mostrar Secret'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Checkbox Recordar en este dispositivo */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-slate-50 p-3 transition hover:border-slate-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-900">
                Recordar en este dispositivo (localStorage)
              </span>
              <p className="mt-0.5 text-slate-700">
                Si desactivas esta casilla, se usará{' '}
                <code className="font-semibold text-slate-900">sessionStorage</code>{' '}
                y la API Key se borrará automáticamente al cerrar la pestaña.
              </p>
            </div>
          </label>

          {/* Mensaje de resultado de prueba o estado */}
          {(localFeedback || connectionMessage) && (
            <div
              className={`rounded-xl border p-3 text-xs font-medium ${
                (localFeedback?.type ??
                  (connectionState === 'valid' ? 'success' : 'error')) ===
                'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : localFeedback?.type === 'info'
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                  : 'border-rose-300 bg-rose-50 text-rose-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {(localFeedback?.type ??
                  (connectionState === 'valid' ? 'success' : 'error')) ===
                'success' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                )}
                <span>{localFeedback?.text ?? connectionMessage}</span>
              </div>
            </div>
          )}

          {/* Enlace de ayuda */}
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>¿No tienes una API Key?</span>
            <a
              href="https://console.higgsfield.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Obtener credenciales en console.higgsfield.ai
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
            <div>
              {hasCredentials && (
                <button
                  type="button"
                  onClick={handleLogoutClear}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Cerrar sesión / Borrar mi key
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isBusy || !keyIdInput.trim() || !keySecretInput.trim()}
                onClick={handleTest}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlugZap className="h-3.5 w-3.5 text-amber-600" />
                )}
                Probar conexión
              </button>

              <button
                type="submit"
                disabled={isBusy || !keyIdInput.trim() || !keySecretInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar y usar Key
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
