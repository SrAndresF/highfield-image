'use client';

import React from 'react';
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Lock,
  ExternalLink,
} from 'lucide-react';
import type { ConnectionState, CreditsInfo } from '@/hooks/useApiKey';

interface HeaderProps {
  hasCredentials: boolean;
  keyIdPreview: string;
  connectionState: ConnectionState;
  creditsInfo: CreditsInfo | null;
  onOpenKeyModal: () => void;
  onRefreshCredits: () => void;
  teamAuthRequired: boolean;
  onLogoutTeamAccess: () => void;
}

export function Header({
  hasCredentials,
  keyIdPreview,
  connectionState,
  creditsInfo,
  onOpenKeyModal,
  onRefreshCredits,
  teamAuthRequired,
  onLogoutTeamAccess,
}: HeaderProps) {
  const renderConnectionBadge = () => {
    if (connectionState === 'testing') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
          Verificando API Key...
        </span>
      );
    }

    if (connectionState === 'valid' && hasCredentials) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Conectado ({keyIdPreview.slice(0, 6)}…)
        </span>
      );
    }

    if (connectionState === 'invalid') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
          <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
          API Key inválida
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        <AlertCircle className="h-3.5 w-3.5 text-slate-500" />
        Sin API Key configurada
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-xs backdrop-blur-md">
      {/* Barra superior de aviso de seguridad */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong className="font-bold text-amber-950">
              Aviso de seguridad:
            </strong>{' '}
            Tu API Key se guarda únicamente en este navegador y se envía en el
            header privado{' '}
            <code className="rounded border border-amber-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
              x-hf-credentials
            </code>
            . No utilices esta opción en computadores públicos o compartidos.
          </span>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        {/* Identidad de marca */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                Higgsfield AI Studio
              </h1>
              <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                SDK v2 · Multi-Usuario
              </span>
            </div>
            <p className="text-xs font-medium text-slate-600">
              Generación de Imágenes y Videos con credenciales individuales (BYOK)
            </p>
          </div>
        </div>

        {/* Estado de conexión, saldo y botones */}
        <div className="flex flex-wrap items-center gap-2.5">
          {renderConnectionBadge()}

          {hasCredentials && (
            <div className="hidden items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 md:flex">
              <span className="font-medium text-slate-600">Estado cuenta:</span>
              <span className="font-bold text-slate-900">
                {creditsInfo?.balanceUsd !== null &&
                creditsInfo?.balanceUsd !== undefined
                  ? `$${creditsInfo.balanceUsd.toFixed(2)} USD`
                  : creditsInfo?.statusLabel ?? 'Pay-as-you-go'}
              </span>
              <button
                type="button"
                onClick={onRefreshCredits}
                title="Verificar estado de conexión y cuenta"
                className="ml-1 rounded p-1 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    connectionState === 'testing' ? 'animate-spin' : ''
                  }`}
                />
              </button>
              <a
                href="https://console.higgsfield.ai"
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir consola de saldo en Higgsfield"
                className="rounded p-1 text-slate-600 transition hover:bg-slate-200 hover:text-indigo-600"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenKeyModal}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition sm:text-sm ${
              hasCredentials
                ? 'border border-slate-300 bg-white text-slate-900 shadow-xs hover:bg-slate-100'
                : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            {hasCredentials ? 'Mi API Key' : 'Configurar API Key'}
          </button>

          {teamAuthRequired && (
            <button
              type="button"
              onClick={onLogoutTeamAccess}
              title="Bloquear sesión de equipo"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bloquear Equipo</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
