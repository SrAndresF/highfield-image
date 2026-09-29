'use client';

import React from 'react';
import {
  Image as ImageIcon,
  Film,
  Sparkles,
  Zap,
  Coins,
  KeyRound,
  Loader2,
  Sliders,
  Wand2,
} from 'lucide-react';
import {
  MODELS,
  type MediaType,
  type ModelConfig,
  type ParameterValue,
} from '@/lib/models';
import type { JobPhase } from '@/hooks/usePolling';

interface GenerationFormProps {
  mediaType: MediaType;
  onChangeMediaType: (type: MediaType) => void;
  selectedModel: ModelConfig;
  onSelectModel: (modelId: string) => void;
  prompt: string;
  onChangePrompt: (val: string) => void;
  params: Record<string, ParameterValue>;
  onChangeParam: (key: string, value: ParameterValue) => void;
  economyMode: boolean;
  onToggleEconomyMode: (enabled: boolean) => void;
  hasCredentials: boolean;
  onOpenKeyModal: () => void;
  phase: JobPhase;
  onSubmit: (e: React.FormEvent) => void;
}

const SAMPLE_PROMPTS: Record<MediaType, string[]> = {
  image: [
    'Retrato cinematográfico de una astronauta explorando un bosque bioluminiscente al atardecer, lente anamórfico 35mm, iluminación volumétrica',
    'Arquitectura minimalista de hormigón y cristal frente a un fiordo nórdico con niebla matutina, fotografía editorial hiperrealista',
  ],
  video: [
    'A cinematic drone shot flying over a futuristic neon cyberpunk street in the rain at night, reflections on wet asphalt, 4k',
    'A slow motion tracking shot of golden sunset waves crashing against volcanic black sand cliffs in Iceland, atmospheric mist',
  ],
};

export function GenerationForm({
  mediaType,
  onChangeMediaType,
  selectedModel,
  onSelectModel,
  prompt,
  onChangePrompt,
  params,
  onChangeParam,
  economyMode,
  onToggleEconomyMode,
  hasCredentials,
  onOpenKeyModal,
  phase,
  onSubmit,
}: GenerationFormProps) {
  const modelsForType = MODELS.filter((m) => m.type === mediaType);
  const isBusy =
    phase === 'submitting' || phase === 'queued' || phase === 'in_progress';

  const renderSubmitLabel = () => {
    if (phase === 'submitting') return 'Enviando a Higgsfield...';
    if (phase === 'queued') return 'En cola de procesamiento...';
    if (phase === 'in_progress') return 'Generando con IA...';
    return mediaType === 'video' ? 'Generar Video con IA' : 'Generar Imagen con IA';
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col space-y-5 rounded-2xl border border-slate-300 bg-white p-5 shadow-md"
    >
      {/* Estado vacío prominente si no hay API Key configurada */}
      {!hasCredentials && (
        <div className="rounded-xl border border-indigo-300 bg-indigo-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-indigo-950">
                  Configura tu API Key para comenzar
                </h3>
                <p className="mt-0.5 text-xs font-medium text-indigo-900">
                  Cada miembro del equipo utiliza su propia API Key de Higgsfield.
                  Los botones de generación se activarán en cuanto la ingreses.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenKeyModal}
              className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Ingresar mi API Key
            </button>
          </div>
        </div>
      )}

      {/* Selector de modo: Imagen vs Video + Preset Modo Económico */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 rounded-xl border border-slate-300 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onChangeMediaType('image')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition sm:text-sm ${
              mediaType === 'image'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white/70 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Imagen
          </button>
          <button
            type="button"
            onClick={() => onChangeMediaType('video')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition sm:text-sm ${
              mediaType === 'video'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white/70 hover:text-slate-900'
            }`}
          >
            <Film className="h-4 w-4" />
            Video
          </button>
        </div>

        {/* Toggle Modo Económico */}
        <button
          type="button"
          onClick={() => onToggleEconomyMode(!economyMode)}
          title="Ajusta automáticamente menor resolución y duración corta para probar prompts gastando menos créditos"
          className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
            economyMode
              ? 'border-emerald-400 bg-emerald-50 text-emerald-900 shadow-xs'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Zap
            className={`h-4 w-4 ${
              economyMode ? 'fill-emerald-600 text-emerald-600' : 'text-slate-500'
            }`}
          />
          <span>Modo Económico</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
              economyMode
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {economyMode ? 'ACTIVO' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Selector de Modelo desde lib/models.ts */}
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="model-selector"
            className="block text-xs font-bold uppercase tracking-wider text-slate-800"
          >
            Modelo de IA ({modelsForType.length} disponibles)
          </label>
          <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
            {selectedModel.badge}
          </span>
        </div>

        <select
          id="model-selector"
          value={selectedModel.id}
          onChange={(e) => onSelectModel(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
        >
          {modelsForType.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — ({m.provider})
            </option>
          ))}
        </select>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
          <span>{selectedModel.description}</span>
          <code className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
            {selectedModel.id}
          </code>
        </div>
      </div>

      {/* Textarea de Prompt */}
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="prompt-textarea"
            className="block text-xs font-bold uppercase tracking-wider text-slate-800"
          >
            Prompt descriptivo
          </label>
          <span className="text-xs font-medium text-slate-600">
            {prompt.length} / 2500 caracteres
          </span>
        </div>

        <textarea
          id="prompt-textarea"
          rows={4}
          maxLength={2500}
          value={prompt}
          onChange={(e) => onChangePrompt(e.target.value)}
          placeholder={
            mediaType === 'video'
              ? 'Describe la escena, el movimiento de cámara, la iluminación y la acción...'
              : 'Describe con detalle la imagen, estilo visual, iluminación y composición...'
          }
          className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white p-3.5 text-sm font-medium text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
        />

        {/* Prompts de ejemplo rápidos */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
            <Wand2 className="h-3.5 w-3.5 text-indigo-600" />
            Ideas rápidas:
          </span>
          {SAMPLE_PROMPTS[mediaType].map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onChangePrompt(sample)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800"
            >
              Ejemplo {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Controles dinámicos según los parámetros del modelo elegido */}
      <div className="space-y-3.5 rounded-xl border border-slate-300 bg-slate-50 p-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
              Parámetros de {selectedModel.name}
            </h3>
          </div>
          {economyMode && (
            <span className="text-xs font-bold text-emerald-700">
              Ajustes optimizados por Modo Económico
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {selectedModel.parameters.map((param) => {
            const currentValue = params[param.key] ?? param.defaultValue;

            if (param.type === 'url') {
              return (
                <div key={param.key} className="sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`param-${param.key}`}
                      className="block text-xs font-bold text-slate-900"
                    >
                      {param.label}{' '}
                      {param.required && (
                        <span className="text-rose-600">*</span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeParam(
                          param.key,
                          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80'
                        )
                      }
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Usar imagen de prueba (Unsplash)
                    </button>
                  </div>
                  {param.description && (
                    <p className="mt-0.5 text-xs text-slate-600">
                      {param.description}
                    </p>
                  )}
                  <input
                    id={`param-${param.key}`}
                    type="url"
                    value={String(currentValue)}
                    onChange={(e) => onChangeParam(param.key, e.target.value)}
                    placeholder={param.placeholder}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-600"
                  />
                </div>
              );
            }

            if (param.type === 'select') {
              return (
                <div key={param.key}>
                  <label
                    htmlFor={`param-${param.key}`}
                    className="block text-xs font-bold text-slate-900"
                  >
                    {param.label}
                  </label>
                  <select
                    id={`param-${param.key}`}
                    value={String(currentValue)}
                    onChange={(e) => {
                      const matched = param.options.find(
                        (o) => String(o.value) === e.target.value
                      );
                      onChangeParam(
                        param.key,
                        matched ? matched.value : e.target.value
                      );
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-600"
                  >
                    {param.options.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (param.type === 'number') {
              return (
                <div key={param.key}>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`param-${param.key}`}
                      className="block text-xs font-bold text-slate-900"
                    >
                      {param.label}
                    </label>
                    {param.optionalRandom && (
                      <button
                        type="button"
                        onClick={() =>
                          onChangeParam(
                            param.key,
                            Math.floor(Math.random() * 999999) + 1
                          )
                        }
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        Aleatoria
                      </button>
                    )}
                  </div>
                  <input
                    id={`param-${param.key}`}
                    type="number"
                    min={param.min}
                    max={param.max}
                    step={param.step ?? 1}
                    value={Number(currentValue)}
                    onChange={(e) =>
                      onChangeParam(param.key, Number(e.target.value))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 outline-none focus:border-indigo-600"
                  />
                  {param.description && (
                    <p className="mt-1 text-[11px] text-slate-600">
                      {param.description}
                    </p>
                  )}
                </div>
              );
            }

            if (param.type === 'boolean') {
              const checked = Boolean(currentValue);
              return (
                <div
                  key={param.key}
                  className="flex items-center justify-between rounded-xl border border-slate-300 bg-white p-3 sm:col-span-2"
                >
                  <div>
                    <span className="block text-xs font-bold text-slate-900">
                      {param.label}
                    </span>
                    {param.description && (
                      <span className="block text-xs text-slate-600">
                        {param.description}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    onClick={() => onChangeParam(param.key, !checked)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      checked ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ${
                        checked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Espacio preparado de Costo por Generación */}
      <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Coins className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="text-xs">
            <span className="font-bold text-slate-900">
              Costo estimado de la generación:{' '}
            </span>
            <span className="font-extrabold text-amber-900">
              {economyMode
                ? selectedModel.estimatedCost.economyLabel
                : selectedModel.estimatedCost.standardLabel}
            </span>
            <p className="mt-0.5 text-xs text-amber-900">
              {selectedModel.estimatedCost.note}
            </p>
          </div>
        </div>
      </div>

      {/* Botón principal de Generar */}
      <button
        type="submit"
        disabled={!hasCredentials || isBusy || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
      >
        {isBusy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
        <span>{renderSubmitLabel()}</span>
      </button>
    </form>
  );
}
