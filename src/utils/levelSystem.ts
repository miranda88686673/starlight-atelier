/**
 * Sistema unificado de progressão de Nível & XP por Login
 * e validação de Nome Único de Personagem (compatível com Cliente e Servidor).
 */

export const MAX_ACCOUNT_LEVEL = 1000;
export const ADMIN_INITIAL_LEVEL = 874;
export const ADMIN_CREATED_AT = '03/03/2023';
export const LOGIN_XP_REWARD = 35;

export interface LoginXpAwardResult {
  level: number;
  xp: number;
  xpRequired: number;
  xpGained: number;
  leveledUp: boolean;
  levelsGained: number;
}

/**
 * Retorna quanto de XP é necessário para avançar do nível atual para o próximo.
 * No nível máximo (1000), retorna 0.
 */
export function getXpRequiredForNextLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel >= MAX_ACCOUNT_LEVEL) return 0;
  return 100 + (safeLevel - 1) * 15;
}

/** Normaliza nível (1..1000) e XP atual, garantindo Nível 874 mínimo para o Administrador Geral */
export function normalizeLevelAndXp(
  rawLevel?: number,
  rawXp?: number,
  isPrimaryAdmin: boolean = false,
): { level: number; xp: number } {
  const minLevel = isPrimaryAdmin ? ADMIN_INITIAL_LEVEL : 1;
  const parsedLevel =
    typeof rawLevel === 'number' && Number.isFinite(rawLevel)
      ? Math.floor(rawLevel)
      : minLevel;
  const level = Math.max(minLevel, Math.min(MAX_ACCOUNT_LEVEL, parsedLevel));

  if (level >= MAX_ACCOUNT_LEVEL) {
    return { level: MAX_ACCOUNT_LEVEL, xp: 0 };
  }

  const req = getXpRequiredForNextLevel(level);
  const parsedXp =
    typeof rawXp === 'number' && Number.isFinite(rawXp) ? Math.max(0, Math.floor(rawXp)) : 0;
  const xp = Math.min(parsedXp, Math.max(0, req - 1));
  return { level, xp };
}

/**
 * Concede XP por entrada (login) na conta.
 * Toda vez que entra na conta a barra sobe; ao completar a barra, sobe de nível (até o nível máximo 1000).
 */
export function awardLoginXp(
  currentLevel?: number,
  currentXp?: number,
  xpGain: number = LOGIN_XP_REWARD,
  isPrimaryAdmin: boolean = false,
): LoginXpAwardResult {
  const normalized = normalizeLevelAndXp(currentLevel, currentXp, isPrimaryAdmin);
  let level = normalized.level;
  let xp = normalized.xp;

  if (level >= MAX_ACCOUNT_LEVEL) {
    return {
      level: MAX_ACCOUNT_LEVEL,
      xp: 0,
      xpRequired: 0,
      xpGained: 0,
      leveledUp: false,
      levelsGained: 0,
    };
  }

  const safeGain = Math.max(1, Math.floor(xpGain));
  xp += safeGain;
  let levelsGained = 0;

  while (level < MAX_ACCOUNT_LEVEL) {
    const required = getXpRequiredForNextLevel(level);
    if (required <= 0 || xp < required) break;
    xp -= required;
    level += 1;
    levelsGained += 1;
  }

  if (level >= MAX_ACCOUNT_LEVEL) {
    level = MAX_ACCOUNT_LEVEL;
    xp = 0;
  }

  return {
    level,
    xp,
    xpRequired: getXpRequiredForNextLevel(level),
    xpGained: safeGain,
    leveledUp: levelsGained > 0,
    levelsGained,
  };
}

/** Calcula porcentagem da barra de progresso para exibição na interface */
export function getLevelProgressMetrics(
  rawLevel?: number,
  rawXp?: number,
  isPrimaryAdmin: boolean = false,
): {
  level: number;
  xp: number;
  xpRequired: number;
  percent: number;
  isMaxLevel: boolean;
} {
  const { level, xp } = normalizeLevelAndXp(rawLevel, rawXp, isPrimaryAdmin);
  if (level >= MAX_ACCOUNT_LEVEL) {
    return {
      level: MAX_ACCOUNT_LEVEL,
      xp: 0,
      xpRequired: 0,
      percent: 100,
      isMaxLevel: true,
    };
  }
  const xpRequired = getXpRequiredForNextLevel(level);
  const percent = xpRequired > 0 ? Math.min(100, Math.round((xp / xpRequired) * 100)) : 100;
  return {
    level,
    xp,
    xpRequired,
    percent,
    isMaxLevel: false,
  };
}

/** Limpa o nome único do personagem preservando capitalização intencional */
export function cleanCharacterName(raw: string): string {
  return (raw || '').trim().replace(/^@+/, '').replace(/\s+/g, ' ');
}

/** Chave canônica para impedir duplicidade de nome (ignora maiúsculas, espaços extras e @) */
export function canonicalCharacterKey(raw: string): string {
  return cleanCharacterName(raw).toLowerCase();
}

/** Chave compactada sem espaços para impedir cópias visuais tipo "Vi tor" vs "Vitor" */
export function collapsedCharacterKey(raw: string): string {
  return canonicalCharacterKey(raw).replace(/[\s_.-]+/g, '');
}

/** Valida formato do nome único de personagem */
export function validateCharacterName(raw: string): string | null {
  const cleaned = cleanCharacterName(raw);
  if (cleaned.length < 3 || cleaned.length > 24) {
    return 'O nome do personagem deve ter entre 3 e 24 caracteres.';
  }
  if (!/^[a-zA-ZÀ-ÿ0-9_ .-]+$/.test(cleaned)) {
    return 'Use apenas letras, números, espaços, ponto (.), hífen (-) ou underline (_) no nome do personagem.';
  }
  if (collapsedCharacterKey(cleaned).length < 3) {
    return 'Informe pelo menos 3 letras ou números no nome do personagem.';
  }
  return null;
}

/** Retorna true se a conta for a conta administradora raiz com AM infinito */
export function isInfiniteAdminAccount(
  account?: {
    id?: string;
    email?: string;
    role?: string;
    staffRoleTier?: string;
    isPrimaryOwner?: boolean;
  } | null,
): boolean {
  if (!account) return false;
  const email = (account.email || '').trim().toLowerCase();
  return Boolean(
    account.isPrimaryOwner ||
      account.id === 'acc_admin_owner' ||
      account.role === 'admin' ||
      account.staffRoleTier === 'admin' ||
      email === 'miranda88686673@gmail.com',
  );
}

