'use client';

import { useState, useEffect, useCallback } from 'react';

const LOCAL_STORAGE_KEY = 'hf_studio_user_credentials_v1';
const SESSION_STORAGE_KEY = 'hf_studio_session_credentials_v1';
const REMEMBER_PREF_KEY = 'hf_studio_remember_device_v1';

export type ConnectionState = 'unconfigured' | 'testing' | 'valid' | 'invalid';

export interface CreditsInfo {
  balanceUsd: number | null;
  statusLabel: string;
  message: string;
}

export interface UseApiKeyReturn {
  credentials: string;
  keyId: string;
  keySecret: string;
  keyHash: string | null;
  hasCredentials: boolean;
  rememberDevice: boolean;
  isHydrated: boolean;
  connectionState: ConnectionState;
  connectionMessage: string | null;
  creditsInfo: CreditsInfo | null;
  saveApiKey: (
    id: string,
    secret: string,
    remember: boolean
  ) => Promise<{ ok: boolean; message: string }>;
  testApiKey: (
    candidateId: string,
    candidateSecret: string
  ) => Promise<{ ok: boolean; message: string; info?: CreditsInfo }>;
  clearApiKey: () => void;
  refreshCredits: () => Promise<void>;
}

/**
 * Calcula un hash SHA-256 en formato hexadecimal usando Web Crypto API
 * para separar el historial por usuario/key sin guardar jamás la key en claro.
 */
export async function computeSha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const byteArray = Array.from(new Uint8Array(digest));
    return byteArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback determinístico si crypto.subtle no está disponible en algún entorno no-HTTPS local
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}

export function useApiKey(): UseApiKeyReturn {
  const [credentials, setCredentials] = useState<string>('');
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [keyHash, setKeyHash] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('unconfigured');
  const [connectionMessage, setConnectionMessage] = useState<string | null>(
    null
  );
  const [creditsInfo, setCreditsInfo] = useState<CreditsInfo | null>(null);

  const testApiKey = useCallback(
    async (
      candidateId: string,
      candidateSecret: string
    ): Promise<{ ok: boolean; message: string; info?: CreditsInfo }> => {
      const trimmedId = candidateId.trim();
      const trimmedSecret = candidateSecret.trim();

      if (!trimmedId || !trimmedSecret) {
        setConnectionState('invalid');
        const msg = 'Debes ingresar tanto el Key ID como el Key Secret.';
        setConnectionMessage(msg);
        return { ok: false, message: msg };
      }

      const combined = `${trimmedId}:${trimmedSecret}`;
      setConnectionState('testing');
      setConnectionMessage('Verificando credenciales con Higgsfield API...');

      try {
        const res = await fetch('/api/credits', {
          method: 'GET',
          headers: {
            'x-hf-credentials': combined,
          },
          cache: 'no-store',
        });

        const data = (await res.json()) as {
          valid?: boolean;
          balanceUsd?: number | null;
          statusLabel?: string;
          message?: string;
          error?: string;
        };

        if (!res.ok || !data.valid) {
          const errMsg =
            data.error ??
            'Credenciales inválidas o rechazadas por Higgsfield API.';
          setConnectionState('invalid');
          setConnectionMessage(errMsg);
          return { ok: false, message: errMsg };
        }

        const info: CreditsInfo = {
          balanceUsd: data.balanceUsd ?? null,
          statusLabel: data.statusLabel ?? 'Key verificada',
          message:
            data.message ??
            'Conexión verificada exitosamente con Higgsfield API.',
        };

        setCreditsInfo(info);
        setConnectionState('valid');
        setConnectionMessage(info.message);
        return { ok: true, message: info.message, info };
      } catch {
        const netMsg =
          'No se pudo conectar con el servidor para validar la API key.';
        setConnectionState('invalid');
        setConnectionMessage(netMsg);
        return { ok: false, message: netMsg };
      }
    },
    []
  );

  // Carga inicial desde localStorage o sessionStorage al montar en el cliente
  useEffect(() => {
    try {
      const savedRemember = localStorage.getItem(REMEMBER_PREF_KEY);
      const shouldRemember =
        savedRemember === null ? true : savedRemember === 'true';
      setRememberDevice(shouldRemember);

      const fromLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
      const fromSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const initialCreds = (fromLocal || fromSession || '').trim();

      if (initialCreds && initialCreds.includes(':')) {
        setCredentials(initialCreds);
        computeSha256Hex(initialCreds).then((hash) => {
          setKeyHash(hash.slice(0, 24));
        });
        const [id, secret] = initialCreds.split(':');
        if (id && secret) {
          void testApiKey(id, secret);
        }
      }
    } catch {
      // Ignorar errores de acceso a storage en modo restringido
    } finally {
      setIsHydrated(true);
    }
  }, [testApiKey]);

  const saveApiKey = useCallback(
    async (
      id: string,
      secret: string,
      remember: boolean
    ): Promise<{ ok: boolean; message: string }> => {
      const trimmedId = id.trim();
      const trimmedSecret = secret.trim();
      if (!trimmedId || !trimmedSecret) {
        return {
          ok: false,
          message: 'Ingresa el Key ID y el Key Secret antes de guardar.',
        };
      }

      const combined = `${trimmedId}:${trimmedSecret}`;

      try {
        localStorage.setItem(REMEMBER_PREF_KEY, String(remember));
        if (remember) {
          localStorage.setItem(LOCAL_STORAGE_KEY, combined);
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } else {
          sessionStorage.setItem(SESSION_STORAGE_KEY, combined);
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      } catch {
        return {
          ok: false,
          message:
            'No fue posible guardar la credencial en el almacenamiento del navegador.',
        };
      }

      setCredentials(combined);
      setRememberDevice(remember);
      const hash = await computeSha256Hex(combined);
      setKeyHash(hash.slice(0, 24));

      const validation = await testApiKey(trimmedId, trimmedSecret);
      return {
        ok: validation.ok,
        message: validation.message,
      };
    },
    [testApiKey]
  );

  const clearApiKey = useCallback(() => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setCredentials('');
    setKeyHash(null);
    setConnectionState('unconfigured');
    setConnectionMessage(null);
    setCreditsInfo(null);
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!credentials || !credentials.includes(':')) return;
    const [id, secret] = credentials.split(':');
    if (id && secret) {
      await testApiKey(id, secret);
    }
  }, [credentials, testApiKey]);

  const parts = credentials.split(':');
  const keyId = parts[0] ?? '';
  const keySecret = parts.slice(1).join(':');

  return {
    credentials,
    keyId,
    keySecret,
    keyHash,
    hasCredentials: Boolean(keyId && keySecret),
    rememberDevice,
    isHydrated,
    connectionState,
    connectionMessage,
    creditsInfo,
    saveApiKey,
    testApiKey,
    clearApiKey,
    refreshCredits,
  };
}
