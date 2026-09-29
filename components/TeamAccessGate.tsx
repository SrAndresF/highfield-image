'use client';

import React, { useState } from 'react';
import { Lock, Loader2, ShieldAlert, ArrowRight } from 'lucide-react';

interface TeamAccessGateProps {
  onSuccess: () => void;
}

export function TeamAccessGate({ onSuccess }: TeamAccessGateProps) {
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = (await res.json()) as {
        authenticated?: boolean;
        error?: string;
      };

      if (!res.ok || !data.authenticated) {
        setError(
          data.error ?? 'Contraseña incorrecta. Inténtalo nuevamente.'
        );
        return;
      }

      onSuccess();
    } catch {
      setError('No fue posible verificar la contraseña con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-8 shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
          <Lock className="h-6 w-6" />
        </div>

        <h1 className="mt-5 text-center text-xl font-extrabold text-slate-900">
          Acceso Privado del Equipo
        </h1>
        <p className="mt-2 text-center text-xs leading-relaxed text-slate-600">
          Este entorno de <strong className="text-slate-900">Higgsfield Studio</strong> está
          protegido por contraseña de equipo (<code className="font-semibold text-indigo-700">APP_ACCESS_PASSWORD</code>).
          Ingresa la clave para desbloquear la aplicación.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="team-access-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-800"
            >
              Contraseña del Equipo
            </label>
            <input
              id="team-access-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa la contraseña compartida..."
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-medium text-rose-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Desbloquear Estudio</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
