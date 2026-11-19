/**
 * Cliente resiliente de API HTTP + Fallback automático via Socket.io RPC.
 * Evita erros de parse HTML/JSON (`res.json()`) e garante que Loja Premium,
 * Mercado, Tickets e Salários funcionem mesmo quando proxies bloqueiam ou
 * interrompem requisições REST individuais.
 */

import { getActiveSyncSocket } from '../core/state/socketBridge';

export interface ApiRequestOptions<TBody = unknown> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: TBody;
  headers?: Record<string, string>;
  socketEvent?: string;
  socketPayload?: unknown;
  timeoutMs?: number;
}

export async function emitSocketRpc<TResponse = Record<string, unknown>>(
  event: string,
  payload: unknown = {},
  timeoutMs = 8000,
): Promise<TResponse | null> {
  const socket = getActiveSyncSocket();
  if (!socket) {
    return null;
  }

  if (!socket.connected) {
    try {
      socket.connect();
    } catch {
      // Ignore reconnect hint errors
    }
    const connected = await new Promise<boolean>((resolve) => {
      const waitTimer = window.setTimeout(() => {
        socket.off('connect', onConnect);
        resolve(false);
      }, 3000);
      const onConnect = () => {
        window.clearTimeout(waitTimer);
        resolve(true);
      };
      socket.once('connect', onConnect);
    });
    if (!connected || !socket.connected) {
      return null;
    }
  }

  return new Promise<TResponse | null>((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    try {
      socket.emit(event, payload, (ackResponse: TResponse) => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(ackResponse ?? null);
        }
      });
    } catch {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

async function parseSafeJsonResponse<TResponse>(
  res: Response,
): Promise<{ parsed: TResponse | null; rawText: string }> {
  const rawText = await res.text().catch(() => '');
  if (!rawText.trim()) {
    return { parsed: null, rawText: '' };
  }
  try {
    return { parsed: JSON.parse(rawText) as TResponse, rawText };
  } catch {
    return { parsed: null, rawText };
  }
}

export async function resilientApiRequest<
  TResponse extends { ok?: boolean; error?: string } = { ok?: boolean; error?: string },
>(
  url: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const {
    method = 'GET',
    body,
    headers = {},
    socketEvent,
    socketPayload,
    timeoutMs = 10_000,
  } = options;

  // 1. Tenta HTTP fetch com tratamento seguro de resposta e timeout
  if (typeof fetch !== 'undefined') {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer =
      controller !== null
        ? window.setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
      const mergedHeaders: Record<string, string> = { ...headers };
      if (body !== undefined && !mergedHeaders['Content-Type']) {
        mergedHeaders['Content-Type'] = 'application/json';
      }

      const res = await fetch(url, {
        method,
        headers: mergedHeaders,
        credentials: 'same-origin',
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
      if (timer !== null) window.clearTimeout(timer);

      const { parsed } = await parseSafeJsonResponse<TResponse>(res);
      if (parsed && typeof parsed === 'object') {
        if (res.ok || parsed.ok === false) {
          return parsed;
        }
      }

      if (res.ok && !parsed) {
        return { ok: true } as TResponse;
      }

      // Se a rota HTTP retornou HTML / 502 / 504 de proxy, tenta Socket.io RPC antes de falhar
      if (socketEvent) {
        const sockRes = await emitSocketRpc<TResponse>(
          socketEvent,
          socketPayload ?? body ?? {},
          timeoutMs,
        );
        if (sockRes && typeof sockRes === 'object') {
          return sockRes;
        }
      }

      return {
        ok: false,
        error: `Servidor respondeu com status ${res.status}. Tente novamente.`,
      } as TResponse;
    } catch {
      if (timer !== null) window.clearTimeout(timer);
      // Fallback direto para Socket.io RPC se o fetch falhar por rede/CORS/proxy
      if (socketEvent) {
        const sockRes = await emitSocketRpc<TResponse>(
          socketEvent,
          socketPayload ?? body ?? {},
          timeoutMs,
        );
        if (sockRes && typeof sockRes === 'object') {
          return sockRes;
        }
      }
      return {
        ok: false,
        error: 'Sem resposta do servidor no momento. Verifique sua conexão e tente novamente.',
      } as TResponse;
    }
  }

  if (socketEvent) {
    const sockRes = await emitSocketRpc<TResponse>(
      socketEvent,
      socketPayload ?? body ?? {},
      timeoutMs,
    );
    if (sockRes && typeof sockRes === 'object') {
      return sockRes;
    }
  }

  return {
    ok: false,
    error: 'Transporte de rede indisponível.',
  } as TResponse;
}
