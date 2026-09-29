'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MODELS,
  getModelById,
  getDefaultParamsForModel,
  type MediaType,
  type ParameterValue,
} from '@/lib/models';
import { useApiKey } from '@/hooks/useApiKey';
import { usePolling, type ActiveGenerationResult } from '@/hooks/usePolling';
import { useHistory, type HistoryEntry } from '@/hooks/useHistory';
import { Header } from '@/components/Header';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { TeamAccessGate } from '@/components/TeamAccessGate';
import { GenerationForm } from '@/components/GenerationForm';
import { ResultPreview } from '@/components/ResultPreview';
import { HistoryList } from '@/components/HistoryList';

export function StudioWorkspace() {
  const apiKeyState = useApiKey();
  const historyState = useHistory(apiKeyState.keyHash);
  const pollingState = usePolling();

  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
  const [teamAuthState, setTeamAuthState] = useState<{
    checked: boolean;
    required: boolean;
    authenticated: boolean;
  }>({
    checked: false,
    required: false,
    authenticated: true,
  });

  // Estado del formulario de generación
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [selectedModelId, setSelectedModelId] = useState<string>(
    'bytedance/seedance-2.5/text-to-video'
  );
  const [prompt, setPrompt] = useState<string>(
    'A cinematic scene at sunset over futuristic floating islands, golden hour volumetric lighting'
  );
  const [economyMode, setEconomyMode] = useState<boolean>(false);
  const [params, setParams] = useState<Record<string, ParameterValue>>(() => {
    const initialModel =
      getModelById('bytedance/seedance-2.5/text-to-video') ?? MODELS[0];
    return getDefaultParamsForModel(initialModel, false);
  });

  // Verificar si el servidor exige APP_ACCESS_PASSWORD al cargar
  const checkTeamAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/access', { cache: 'no-store' });
      const data = (await res.json()) as {
        required?: boolean;
        authenticated?: boolean;
      };
      setTeamAuthState({
        checked: true,
        required: Boolean(data.required),
        authenticated: Boolean(data.authenticated),
      });
    } catch {
      setTeamAuthState({
        checked: true,
        required: false,
        authenticated: true,
      });
    }
  }, []);

  useEffect(() => {
    void checkTeamAccess();
  }, [checkTeamAccess]);

  const selectedModel =
    getModelById(selectedModelId) ??
    MODELS.find((m) => m.type === mediaType) ??
    MODELS[0];

  const handleChangeMediaType = (newType: MediaType) => {
    setMediaType(newType);
    const firstModel = MODELS.find((m) => m.type === newType);
    if (firstModel) {
      setSelectedModelId(firstModel.id);
      setParams(getDefaultParamsForModel(firstModel, economyMode));
    }
  };

  const handleSelectModel = (newModelId: string) => {
    const found = getModelById(newModelId);
    if (!found) return;
    setSelectedModelId(found.id);
    setMediaType(found.type);
    setParams(getDefaultParamsForModel(found, economyMode));
  };

  const handleToggleEconomyMode = (enabled: boolean) => {
    setEconomyMode(enabled);
    if (enabled) {
      setParams((prev) => ({
        ...prev,
        ...selectedModel.economyPreset,
      }));
    } else {
      setParams(getDefaultParamsForModel(selectedModel, false));
    }
  };

  const handleChangeParam = (key: string, value: ParameterValue) => {
    setParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleJobCompleted = useCallback(
    (result: ActiveGenerationResult) => {
      historyState.addHistoryEntry({
        requestId: result.requestId,
        prompt: result.prompt,
        modelId: result.modelId,
        modelName: result.modelName,
        mediaType: result.mediaType,
        params: result.params,
        resultUrl: result.resultUrl,
        images: result.images,
        videoUrl: result.videoUrl,
        createdAt: result.completedAt,
      });
    },
    [historyState]
  );

  const handleSubmitGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyState.hasCredentials) {
      setIsKeyModalOpen(true);
      return;
    }

    await pollingState.startGeneration({
      credentials: apiKeyState.credentials,
      modelId: selectedModel.id,
      modelName: selectedModel.name,
      mediaType: selectedModel.type,
      prompt: prompt.trim(),
      params,
      onCompleted: handleJobCompleted,
    });
  };

  const handleReuseEntry = (entry: HistoryEntry) => {
    const targetModel = getModelById(entry.modelId);
    if (targetModel) {
      setMediaType(targetModel.type);
      setSelectedModelId(targetModel.id);
      setParams({
        ...getDefaultParamsForModel(targetModel, false),
        ...entry.params,
      });
    }
    setPrompt(entry.prompt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectHistoryPreview = (entry: HistoryEntry) => {
    pollingState.selectResultFromHistory({
      requestId: entry.requestId,
      modelId: entry.modelId,
      modelName: entry.modelName,
      mediaType: entry.mediaType,
      prompt: entry.prompt,
      params: entry.params,
      resultUrl: entry.resultUrl,
      images: entry.images,
      videoUrl: entry.videoUrl,
      completedAt: entry.createdAt,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogoutTeamAccess = async () => {
    await fetch('/api/auth/access', { method: 'DELETE' });
    setTeamAuthState((prev) => ({
      ...prev,
      authenticated: false,
    }));
  };

  if (!teamAuthState.checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-700">
        Cargando entorno seguro de Higgsfield AI Studio...
      </div>
    );
  }

  if (teamAuthState.required && !teamAuthState.authenticated) {
    return (
      <TeamAccessGate
        onSuccess={() =>
          setTeamAuthState((prev) => ({ ...prev, authenticated: true }))
        }
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header
        hasCredentials={apiKeyState.hasCredentials}
        keyIdPreview={apiKeyState.keyId}
        connectionState={apiKeyState.connectionState}
        creditsInfo={apiKeyState.creditsInfo}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        onRefreshCredits={() => void apiKeyState.refreshCredits()}
        teamAuthRequired={teamAuthState.required}
        onLogoutTeamAccess={handleLogoutTeamAccess}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Columna izquierda: Formulario dinámico */}
          <div className="lg:col-span-6 xl:col-span-5">
            <GenerationForm
              mediaType={mediaType}
              onChangeMediaType={handleChangeMediaType}
              selectedModel={selectedModel}
              onSelectModel={handleSelectModel}
              prompt={prompt}
              onChangePrompt={setPrompt}
              params={params}
              onChangeParam={handleChangeParam}
              economyMode={economyMode}
              onToggleEconomyMode={handleToggleEconomyMode}
              hasCredentials={apiKeyState.hasCredentials}
              onOpenKeyModal={() => setIsKeyModalOpen(true)}
              phase={pollingState.phase}
              onSubmit={handleSubmitGeneration}
            />
          </div>

          {/* Columna derecha: Lienzo de Resultado en vivo */}
          <div className="lg:col-span-6 xl:col-span-7">
            <ResultPreview
              phase={pollingState.phase}
              requestId={pollingState.requestId}
              elapsedSeconds={pollingState.elapsedSeconds}
              errorMessage={pollingState.errorMessage}
              activeResult={pollingState.activeResult}
              isCanceling={pollingState.isCanceling}
              onCancel={() =>
                void pollingState.cancelGeneration(apiKeyState.credentials)
              }
            />
          </div>
        </div>

        {/* Sección inferior: Historial en localStorage aislado por hash SHA-256 de la API Key */}
        <HistoryList
          items={historyState.items}
          keyHash={apiKeyState.keyHash}
          onReuseEntry={handleReuseEntry}
          onSelectPreview={handleSelectHistoryPreview}
          onDeleteEntry={historyState.removeHistoryEntry}
          onClearAll={historyState.clearHistoryForCurrentUser}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs font-medium text-slate-600">
        <div className="mx-auto max-w-7xl px-4">
          Higgsfield AI Studio · Arquitectura BYOK (Bring Your Own Key) sin
          almacenamiento de credenciales en servidor · SDK{' '}
          <code className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800">
            @higgsfield/client/v2
          </code>
        </div>
      </footer>

      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        currentKeyId={apiKeyState.keyId}
        currentKeySecret={apiKeyState.keySecret}
        currentRemember={apiKeyState.rememberDevice}
        hasCredentials={apiKeyState.hasCredentials}
        connectionState={apiKeyState.connectionState}
        connectionMessage={apiKeyState.connectionMessage}
        onSaveKey={apiKeyState.saveApiKey}
        onTestKey={apiKeyState.testApiKey}
        onClearKey={apiKeyState.clearApiKey}
      />
    </div>
  );
}
