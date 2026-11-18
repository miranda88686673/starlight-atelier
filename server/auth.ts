/**
 * Módulo de Autenticação, Criptografia de Senha (scrypt) e Recuperação de Conta.
 * Roda exclusivamente no servidor Node.js (nunca expõe hashes/tokens secretos ao cliente).
 */

import crypto from 'node:crypto';
import type { PlayerProgressState, ServerRegion, UserAccount } from '../src/types/game.ts';
import {
  ADMIN_CREATED_AT,
  ADMIN_INITIAL_LEVEL,
} from '../src/utils/levelSystem.ts';

export const ADMIN_OWNER_EMAIL = 'miranda88686673@gmail.com';

const SCRYPT_KEYLEN = 64;
const PASSWORD_HASH_PREFIX = 'scrypt$';

export function normalizeUsernameServer(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/** Gera hash criptográfico salgado com crypto.scryptSync */
export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, SCRYPT_KEYLEN).toString('hex');
  return `${PASSWORD_HASH_PREFIX}${salt}$${derived}`;
}

/** Valida senha com tempo constante (timingSafeEqual) contra hash scrypt ou legado */
export function verifyPassword(
  plainPassword: string,
  passwordHash?: string,
  legacyPlainPassword?: string,
): boolean {
  const cleaned = plainPassword.trim();
  if (!cleaned) return false;

  if (passwordHash && passwordHash.startsWith(PASSWORD_HASH_PREFIX)) {
    const parts = passwordHash.split('$');
    if (parts.length === 3) {
      const salt = parts[1];
      const expectedHex = parts[2];
      try {
        const expectedBuf = Buffer.from(expectedHex, 'hex');
        const actualBuf = crypto.scryptSync(cleaned, salt, expectedBuf.length);
        if (actualBuf.length === expectedBuf.length) {
          return crypto.timingSafeEqual(actualBuf, expectedBuf);
        }
      } catch {
        return false;
      }
    }
  }

  if (legacyPlainPassword && legacyPlainPassword === cleaned) {
    return true;
  }

  return false;
}

/** Remove segredos sensíveis antes de enviar UserAccount para clientes conectados */
export function sanitizeAccountForClient(account: UserAccount): UserAccount {
  return {
    ...account,
    password: '',
    password_hash: undefined,
  };
}

/** Cria estado inicial de progresso para uma conta recém-registrada no servidor */
export function buildInitialPlayerProgressServer(
  accountId: string,
  avatarGender: UserAccount['avatarGender'],
  serverRegion: ServerRegion = 'BR',
  isPrimaryAdmin: boolean = accountId === 'acc_admin_owner',
): PlayerProgressState {
  const countryCode =
    serverRegion === 'ES' ? 'ES' : serverRegion === 'EN' ? 'US' : 'BR';
  const timezone =
    serverRegion === 'ES'
      ? 'Europe/Madrid'
      : serverRegion === 'EN'
        ? 'America/New_York'
        : 'America/Sao_Paulo';

  return {
    catalogSchemaVersion: 4,
    level: isPrimaryAdmin ? ADMIN_INITIAL_LEVEL : 1,
    xp: 0,
    starcoins: 1200,
    ownedItemIds: [],
    ownedFurnitureIds: ['furn_tapete_persa', 'furn_sofa_veludo', 'furn_luminaria_arco'],
    ownedRoomTemplateIds: ['tpl_room_cozy', 'tpl_room_lounge'],
    ownedWallpaperIds: ['wp_boiserie_marfim'],
    equipped: {},
    skinTone: 'pessego',
    avatarGender,
    avatarDisplayMode: 'medoll',
    bio: 'Explorando estilos na Starplaza e decorando minha Suíte no Nocturne Vale Club.',
    presenceStatus: 'online',
    countryCode,
    timezone,
    simulatedIp: `189.42.${Math.max(10, accountId.length * 7 % 230)}.42`,
    friendUsernames: [],
    suite: {
      theme: 'paris_marfim',
      wallpaperId: 'wp_boiserie_marfim',
      items: [],
      avatarPos: {
        x: 292,
        y: 138,
        zIndex: 14,
        flipped: false,
      },
      lastSavedAt: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  };
}

/** Contas iniciais oficiais garantidas no banco do servidor já com password_hash */
export function createSeededServerAccounts(): UserAccount[] {
  return [
    {
      id: 'acc_admin_owner',
      username: 'Vitor',
      displayName: 'Vitor',
      email: ADMIN_OWNER_EMAIL,
      password: '',
      password_hash: hashPassword('@manuel868673'),
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'admin',
      staffRoleTitle: 'Administrador Geral',
      isVip: true,
      isPrimaryOwner: true,
      createdAt: ADMIN_CREATED_AT,
    },
  ];
}

export function generateRecoveryToken(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

/**
 * Envia token de recuperação via Resend API caso RESEND_API_KEY esteja configurada,
 * ou retorna modo `in_app_dispatch` para ambientes sem provedor SMTP externo.
 */
export async function sendRecoveryEmailIfConfigured(params: {
  toEmail: string;
  username: string;
  token: string;
}): Promise<{ deliveredByEmail: boolean; provider: 'resend' | 'local_dispatch' }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { deliveredByEmail: false, provider: 'local_dispatch' };
  }

  try {
    const fromEmail =
      process.env.RECOVERY_FROM_EMAIL || 'Nocturne Vale Club <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.toEmail],
        subject: 'Nocturne Vale Club · Código de Redefinição de Senha',
        html:
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e6e0d8;border-radius:12px;">` +
          `<h2 style="color:#c8235d;margin:0 0 12px;">Nocturne Vale Club</h2>` +
          `<p>Olá <strong>@${params.username}</strong>,</p>` +
          `<p>Recebemos uma solicitação para redefinir a senha da sua conta. Use o código temporário abaixo (válido por 15 minutos):</p>` +
          `<div style="font-size:24px;font-weight:bold;letter-spacing:6px;background:#faf8f5;padding:16px;text-align:center;border-radius:8px;margin:16px 0;color:#1c1917;">${params.token}</div>` +
          `<p style="color:#6b645d;font-size:12px;">Se você não solicitou esta alteração, ignore este e-mail.</p>` +
          `</div>`,
      }),
    });
    if (res.ok) {
      return { deliveredByEmail: true, provider: 'resend' };
    }
  } catch {
    // Fallback seguro
  }

  return { deliveredByEmail: false, provider: 'local_dispatch' };
}
