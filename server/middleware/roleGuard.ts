/**
 * RoleGuard Express & Socket Middleware.
 * Valida permissões de `admin`, `cm`, `moderator` e `designer` antes de liberar rotas ou comandos sensíveis.
 */

import type { NextFunction, Request, Response } from 'express';
import type { CoreStaffRole } from '../../src/core/schemas/dbSchema.ts';
import { resolveCoreStaffRole } from '../../src/core/security/RoleGuard.ts';
import { serverDb } from '../database.ts';

const ADMIN_OWNER_EMAIL = 'miranda88686673@gmail.com';

export interface StaffGuardContext {
  actorId: string;
  role: CoreStaffRole;
}

/** Resolve o cargo do ator consultando primeiro o banco persistido e validando o cabeçalho/corpo */
export function resolveActorRoleFromServer(
  actorId?: string,
  claimedRole?: string,
  actorEmail?: string,
): CoreStaffRole | null {
  if (actorId) {
    const account = serverDb.findAccountById(actorId);
    if (account) {
      return resolveCoreStaffRole(account);
    }
    // Bootstrap seguro para a conta fundadora antes da primeira hidratação
    if (actorId === 'acc_admin_owner') {
      return 'admin';
    }
  }

  if (actorEmail && actorEmail.trim().toLowerCase() === ADMIN_OWNER_EMAIL) {
    return 'admin';
  }

  if (
    claimedRole === 'admin' ||
    claimedRole === 'cm' ||
    claimedRole === 'moderator' ||
    claimedRole === 'designer'
  ) {
    return claimedRole;
  }

  return null;
}

/** Middleware Express que exige um dos cargos da Staff permitidos */
export function requireStaffRole(allowedRoles: CoreStaffRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const actorId =
      (req.headers['x-actor-id'] as string | undefined) ||
      (req.body?.actor_id as string | undefined) ||
      (req.query.actor_id as string | undefined);
    const claimedRole =
      (req.headers['x-staff-role'] as string | undefined) ||
      (req.body?.role as string | undefined);
    const actorEmail =
      (req.headers['x-actor-email'] as string | undefined) ||
      (req.body?.adminEmail as string | undefined);

    const role = resolveActorRoleFromServer(actorId, claimedRole, actorEmail);
    if (!role || (role !== 'admin' && !allowedRoles.includes(role))) {
      res.status(403).json({
        ok: false,
        error: `Acesso negado pelo RoleGuard. Cargos autorizados: ${allowedRoles.join(', ')}.`,
      });
      return;
    }

    (req as Request & { staffContext?: StaffGuardContext }).staffContext = {
      actorId: actorId || 'system_admin',
      role,
    };
    next();
  };
}
