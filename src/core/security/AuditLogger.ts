/**
 * AuditLogger — Middleware e utilitário global de auditoria interna da Staff.
 * Registra ações administrativas na coleção protegida `staff_audit_logs` via Socket.io e API REST.
 */

import type { CoreStaffRole, StaffAuditLogEntry } from '../schemas/dbSchema';

type AuditEmitter = (entry: StaffAuditLogEntry) => void;

const LOCAL_AUDIT_CACHE_KEY = 'starlight_atelier_staff_audit_logs_v1';
const auditSubscribers = new Set<(logs: StaffAuditLogEntry[]) => void>();
let socketAuditEmitter: AuditEmitter | null = null;

export function registerAuditSocketEmitter(emitter: AuditEmitter | null): void {
  socketAuditEmitter = emitter;
}

export function subscribeAuditLogs(
  listener: (logs: StaffAuditLogEntry[]) => void,
): () => void {
  auditSubscribers.add(listener);
  return () => {
    auditSubscribers.delete(listener);
  };
}

export function readCachedAuditLogs(): StaffAuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_AUDIT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StaffAuditLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function writeCachedAuditLogs(logs: StaffAuditLogEntry[]): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        LOCAL_AUDIT_CACHE_KEY,
        JSON.stringify(logs.slice(0, 250)),
      );
    } catch {
      // Silencioso
    }
  }
  auditSubscribers.forEach((fn) => fn(logs));
}

/**
 * Registra globalmente uma ação da Staff em `staff_audit_logs`.
 * Assinatura oficial: logStaffAction(actor_id, role, action_type, target_id, details)
 */
export async function logStaffAction(
  actor_id: string,
  role: CoreStaffRole,
  action_type: string,
  target_id: string,
  details: string,
  actor_username?: string,
): Promise<StaffAuditLogEntry> {
  const entry: StaffAuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    actor_id,
    actor_username,
    role,
    action_type,
    target_id,
    details,
  };

  // Atualiza cache local imediato
  const nextLocal = [entry, ...readCachedAuditLogs()].slice(0, 250);
  writeCachedAuditLogs(nextLocal);

  // Emite via Socket.io se conectado
  if (socketAuditEmitter) {
    try {
      socketAuditEmitter(entry);
    } catch {
      // Continua para persistência REST
    }
  }

  // Persiste na rota protegida do servidor
  if (typeof fetch !== 'undefined') {
    try {
      await fetch('/api/staff/audit-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-id': actor_id,
          'x-staff-role': role,
        },
        body: JSON.stringify(entry),
      });
    } catch {
      // Socket já entregou ou servidor indisponível temporariamente
    }
  }

  return entry;
}
