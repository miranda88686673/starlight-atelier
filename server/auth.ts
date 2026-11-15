/**
 * Módulo de Autenticação, Criptografia de Senha (scrypt) e Recuperação de Conta.
 * Roda exclusivamente no servidor Node.js (nunca expõe hashes/tokens secretos ao cliente).
 */

import crypto from 'node:crypto';
import type { PlayerProgressState, ServerRegion, UserAccount } from '../src/types/game.ts';

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
): PlayerProgressState {
  const starterItems = [
    'hair_ondas_mel',
    'hair_bob_paris',
    'hair_corte_executivo',
    'hair_fade_moderno',
    'top_camisa_seda',
    'top_cropped_veludo',
    'top_camisa_social_azul',
    'top_jaqueta_couro',
    'bottom_saia_midi',
    'bottom_calca_alfaiataria',
    'bottom_chino_areia',
    'shoes_scarpin_preto',
    'shoes_oxford_couro',
    'shoes_tenis_branco',
  ];

  const defaultEquipped =
    avatarGender === 'masculino'
      ? {
          cabelo: 'hair_corte_executivo',
          blusas: 'top_camisa_social_azul',
          calcas: 'bottom_chino_areia',
          sapatos: 'shoes_oxford_couro',
        }
      : avatarGender === 'neutro'
        ? {
            cabelo: 'hair_coque_atelier',
            blusas: 'top_camisa_seda',
            calcas: 'bottom_calca_alfaiataria',
            sapatos: 'shoes_tenis_branco',
          }
        : {
            cabelo: 'hair_ondas_mel',
            blusas: 'top_camisa_seda',
            calcas: 'bottom_saia_midi',
            sapatos: 'shoes_scarpin_preto',
          };

  const countryCode =
    serverRegion === 'ES' ? 'ES' : serverRegion === 'EN' ? 'US' : 'BR';
  const timezone =
    serverRegion === 'ES'
      ? 'Europe/Madrid'
      : serverRegion === 'EN'
        ? 'America/New_York'
        : 'America/Sao_Paulo';

  return {
    starcoins: 1200,
    ownedItemIds:
      avatarGender === 'neutro'
        ? Array.from(new Set([...starterItems, 'hair_coque_atelier']))
        : starterItems,
    ownedFurnitureIds: ['furn_tapete_persa', 'furn_sofa_veludo', 'furn_luminaria_arco'],
    ownedRoomTemplateIds: ['tpl_room_cozy', 'tpl_room_lounge'],
    ownedWallpaperIds: ['wp_boiserie_marfim'],
    equipped: defaultEquipped,
    skinTone: 'pessego',
    avatarGender,
    avatarDisplayMode: 'medoll',
    bio: 'Explorando estilos na Starplaza e decorando minha Suíte no Starlight Atelier.',
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
      username: 'vitor',
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
      createdAt: '01/01/2025',
    },
    {
      id: 'acc_staff_bella',
      username: 'bella_mod',
      displayName: 'Bella',
      email: 'bella@starlightatelier.com',
      password: '',
      password_hash: hashPassword('staff123'),
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'mod_br',
      staffRoleTitle: 'Moderador (BR)',
      serverRegion: 'BR',
      isBot: true,
      botAiSpecialty: 'moderation',
      botActive: true,
      botRoamRooms: true,
      createdAt: '05/01/2025',
    },
    {
      id: 'acc_staff_kaio',
      username: 'kaio_dev',
      displayName: 'Kaio',
      email: 'kaio@starlightatelier.com',
      password: '',
      password_hash: hashPassword('staff123'),
      avatarGender: 'masculino',
      role: 'admin',
      staffRoleTier: 'mod_en',
      staffRoleTitle: 'Moderador (EN)',
      serverRegion: 'EN',
      isBot: true,
      botAiSpecialty: 'hybrid',
      botActive: true,
      botRoamRooms: true,
      createdAt: '10/01/2025',
    },
    {
      id: 'acc_staff_mari',
      username: 'mari_estilo',
      displayName: 'Mari',
      email: 'mari@starlightatelier.com',
      password: '',
      password_hash: hashPassword('staff123'),
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'mod_es',
      staffRoleTitle: 'Moderador (ES)',
      serverRegion: 'ES',
      isBot: true,
      botAiSpecialty: 'moderation',
      botActive: true,
      botRoamRooms: true,
      createdAt: '15/01/2025',
    },
    {
      id: 'acc_staff_lucas',
      username: 'lucas_eventos',
      displayName: 'Lucas',
      email: 'lucas@starlightatelier.com',
      password: '',
      password_hash: hashPassword('staff123'),
      avatarGender: 'masculino',
      role: 'admin',
      staffRoleTier: 'cm_br',
      staffRoleTitle: 'Gerente da Comunidade (BR)',
      serverRegion: 'BR',
      isBot: true,
      botAiSpecialty: 'hybrid',
      botActive: true,
      botRoamRooms: true,
      createdAt: '18/01/2025',
    },
    {
      id: 'acc_staff_celine',
      username: 'celine_atelier',
      displayName: 'Celine',
      email: 'celine@starlightatelier.com',
      password: '',
      password_hash: hashPassword('staff123'),
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'designer_global',
      staffRoleTitle: 'Designer Global',
      isVip: true,
      isBot: true,
      botAiSpecialty: 'designer',
      botActive: true,
      botRoamRooms: true,
      createdAt: '20/01/2025',
    },
    {
      id: 'acc_staff_sofia_cm',
      username: 'sofia_comunidad',
      displayName: 'Sofía',
      email: 'sofia@starlightatelier.com',
      password: '',
      password_hash: hashPassword('staff123'),
      avatarGender: 'feminino',
      role: 'admin',
      staffRoleTier: 'cm_es',
      staffRoleTitle: 'Gerente da Comunidade (ES)',
      serverRegion: 'ES',
      isBot: true,
      botAiSpecialty: 'hybrid',
      botActive: true,
      botRoamRooms: true,
      createdAt: '22/01/2025',
    },
    {
      id: 'acc_staff_alex_cm',
      username: 'alex_community',
      displayName: 'Alex',
      email: 'alex@starlightatelier.com',
      password: '',
      password_hash: hashPassword('staff123'),
      avatarGender: 'masculino',
      role: 'admin',
      staffRoleTier: 'cm_en',
      staffRoleTitle: 'Gerente da Comunidade (EN)',
      serverRegion: 'EN',
      isBot: true,
      botAiSpecialty: 'hybrid',
      botActive: true,
      botRoamRooms: true,
      createdAt: '24/01/2025',
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
      process.env.RECOVERY_FROM_EMAIL || 'Starlight Atelier <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.toEmail],
        subject: 'Starlight Atelier · Código de Redefinição de Senha',
        html:
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e6e0d8;border-radius:12px;">` +
          `<h2 style="color:#c8235d;margin:0 0 12px;">Starlight Atelier</h2>` +
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
