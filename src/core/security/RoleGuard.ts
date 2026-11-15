/**
 * RoleGuard — Controle de Acesso Baseado em Cargos (RBAC) para Frontend e Comandos.
 * Valida permissões de admin, cm, moderator e designer antes de ações sensíveis.
 */

import type { StaffRoleTier, UserAccount } from '../../types/game.ts';
import type { CoreStaffRole } from '../schemas/dbSchema.ts';

export class RoleGuardError extends Error {
  readonly code = 'ROLE_GUARD_FORBIDDEN';
  readonly requiredRoles: CoreStaffRole[];

  constructor(message: string, requiredRoles: CoreStaffRole[]) {
    super(message);
    this.name = 'RoleGuardError';
    this.requiredRoles = requiredRoles;
  }
}

/** Converte StaffRoleTier / UserAccount para CoreStaffRole padronizado */
export function resolveCoreStaffRole(
  account?: Pick<UserAccount, 'role' | 'staffRoleTier' | 'isPrimaryOwner' | 'email'> | null,
): CoreStaffRole | null {
  if (!account) return null;
  if (
    account.isPrimaryOwner ||
    account.staffRoleTier === 'admin' ||
    account.email?.trim().toLowerCase() === 'miranda88686673@gmail.com'
  ) {
    return 'admin';
  }
  const tier: StaffRoleTier | undefined = account.staffRoleTier;
  if (tier === 'cm_br' || tier === 'cm_es' || tier === 'cm_en') {
    return 'cm';
  }
  if (tier === 'mod_br' || tier === 'mod_es' || tier === 'mod_en') {
    return 'moderator';
  }
  if (tier === 'designer_global') {
    return 'designer';
  }
  if (account.role === 'admin') {
    return 'admin';
  }
  return null;
}

/** Verifica se o usuário possui ao menos um dos cargos permitidos (admin possui acesso total) */
export function hasRolePermission(
  account: Pick<UserAccount, 'role' | 'staffRoleTier' | 'isPrimaryOwner' | 'email'> | null | undefined,
  allowedRoles: CoreStaffRole[],
): boolean {
  const role = resolveCoreStaffRole(account);
  if (!role) return false;
  if (role === 'admin') return true;
  return allowedRoles.includes(role);
}

/** Lança RoleGuardError se o usuário não atender aos requisitos de cargo */
export function assertRolePermission(
  account: Pick<UserAccount, 'role' | 'staffRoleTier' | 'isPrimaryOwner' | 'email'> | null | undefined,
  allowedRoles: CoreStaffRole[],
  actionLabel = 'executar esta ação administrativa',
): CoreStaffRole {
  const role = resolveCoreStaffRole(account);
  if (!role || (role !== 'admin' && !allowedRoles.includes(role))) {
    throw new RoleGuardError(
      `Acesso negado pelo RoleGuard: permissão insuficiente para ${actionLabel}.`,
      allowedRoles,
    );
  }
  return role;
}
