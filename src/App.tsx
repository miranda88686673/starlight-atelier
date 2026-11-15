/**
 * Starlight Atelier — Protótipo de Jogo Web 2D inspirado no Stardoll.
 *
 * Arquitetura integrada:
 * - Autenticação (LoginModal): Login e Criação de Conta com persistência no localStorage.
 * - MeDollStudio: Boneca base + camadas (z-index) + guarda-roupa compatível por gênero e VIP.
 * - StarplazaShop: Loja virtual + Boutique VIP Exclusiva com compra em Starcoins.
 * - SuiteRoom: Decoração de quarto 2D com arraste livre e armário integrado.
 * - RoomView: Salas multiplayer em tempo real + Bots autônomos da Staff.
 * - ModPanel: Hierarquia Staff, Ferramentas do Administrador, Ateliê de Criação e IA Autônoma.
 */

import { useMemo, useRef, useState } from 'react';
import { Coins, LogOut, Megaphone, Volume2, VolumeX } from 'lucide-react';
import { LoginModal } from './components/LoginModal';
import { MeDollStudio } from './components/MeDollStudio';
import { ModPanel, type StaffPanelSubTab } from './components/ModPanel';
import { NewsFeedView } from './components/NewsFeedView';
import { PRESENCE_META, ProfileAccountView } from './components/ProfileAccountView';
import { ProfileAvatar } from './components/ProfileAvatar';
import { PublicProfileFallback, RoomView } from './components/RoomView';
import {
  StaffBotEditorPayload,
  StaffRoleBadge,
  VipBadge,
} from './components/StaffDirectory';
import { StarplazaShop } from './components/StarplazaShop';
import { SuiteRoom } from './components/SuiteRoom';
import { VipCoinsStoreView } from './components/VipCoinsStoreView';
import { VisitorProfileModal } from './components/VisitorProfileModal';
import { useGameRealtime } from './context/GameRealtimeContext';
import { getActiveSyncSocket } from './core/state/socketBridge';
import {
  AvatarDisplayMode,
  AvatarGender,
  ClothingCategory,
  ClothingItem,
  FurnitureDef,
  GameTab,
  MockUser,
  PlayerProgressState,
  PublicProfileSummary,
  PurchasableRoomItem,
  PurchasableWallpaperItem,
  RoomId,
  ServerRegion,
  SkinToneId,
  StaffRoleTier,
  SuiteLayoutState,
  UserAccount,
} from './types/game';
import {
  appendAiLog,
  evaluateMessageWithSentinelBot,
  loadAiLogs,
} from './utils/aiBots';
import {
  appendRoomMessage,
  createRealtimeChannel,
  readRoomsSnapshot,
} from './utils/realtime';
import { soundEngine } from './utils/sound';
import {
  addCustomClothingToWorld,
  addCustomFurnitureToWorld,
  addCustomRoomTemplateToWorld,
  addCustomWallpaperToWorld,
  canBanInServer,
  canManageCommunityInServer,
  createStaffAccount,
  ensureAccountForCommunityUser,
  getAccountByIdOrUsername,
  getModeratorServer,
  inferServerRegionFromCountry,
  isItemCompatibleWithGender,
  isPrimaryAdminAccount,
  isVipAccount,
  loadAccounts,
  loadPlayerProgress,
  loadWorldState,
  logoutAccount,
  normalizeUsername,
  removeStaffMember,
  resetAccountAndWorld,
  resolvePublicProfileSummary,
  toggleUserVipStatus,
  unequipIncompatibleClothes,
  updateAccountIdentity,
  updateAccountStaffAssignment,
  updateStaffProfileByAdmin,
} from './utils/storage';
import { logStaffAction } from './core/security/AuditLogger';
import { hasRolePermission, resolveCoreStaffRole } from './core/security/RoleGuard';

export default function App() {
  const {
    currentUser,
    setCurrentUser,
    playerState,
    setPlayerState,
    worldState,
    setWorldState,
    setAiLogs,
    fullClothingCatalog,
    fullFurnitureCatalog,
    fullRoomCatalog,
    fullWallpaperCatalog,
    accountIsVip,
    publishNewsPost,
  } = useGameRealtime();

  const [activeTab, setActiveTab] = useState<GameTab>('medoll');
  const [staffSubTab, setStaffSubTab] = useState<StaffPanelSubTab | undefined>(undefined);
  const [isMuted, setIsMuted] = useState(false);
  const [genderNotice, setGenderNotice] = useState<string | null>(null);
  const genderNoticeTimerRef = useRef<number | null>(null);

  const [publicProfileTarget, setPublicProfileTarget] = useState<{
    username: string;
    fallbackAppearance?: PublicProfileFallback;
  } | null>(null);
  const [visitingSuiteProfile, setVisitingSuiteProfile] =
    useState<PublicProfileSummary | null>(null);
  const [sentinelLockoutReason, setSentinelLockoutReason] = useState<string | null>(
    null,
  );

  const navItems = useMemo<Array<{ id: GameTab; label: string }>>(
    () => [
      { id: 'perfil', label: 'Meu Perfil' },
      { id: 'suite', label: 'Suíte' },
      { id: 'medoll', label: 'MeDoll' },
      { id: 'starplaza', label: 'Starplaza' },
      { id: 'salas', label: 'Salas' },
      { id: 'noticias', label: 'Notícias' },
      { id: 'vip_loja', label: 'Loja Premium' },
      { id: 'modtools', label: 'Moderação' },
    ],
    [],
  );

  const handleAuthenticated = (account: UserAccount) => {
    setSentinelLockoutReason(null);
    setCurrentUser(account);
    setPlayerState(loadPlayerProgress(account.id, account.avatarGender));
    setWorldState(loadWorldState());
    setActiveTab('medoll');
  };

  const handleLogout = () => {
    soundEngine.playEquip();
    logoutAccount();
    setSentinelLockoutReason(null);
    setCurrentUser(null);
    setActiveTab('medoll');
  };

  const handleToggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // --- Handlers do Módulo 1: MeDoll ---
  const handleToggleEquip = (item: ClothingItem) => {
    const compatible = isItemCompatibleWithGender(
      item.gender ?? item.genderStyle,
      playerState.avatarGender,
    );
    if (!compatible) {
      setGenderNotice(
        `A peça "${item.name}" foi desenhada para corpo ${item.gender} e não veste no corpo ${playerState.avatarGender}.`,
      );
      return;
    }
    if (item.isVipOnly && !accountIsVip) {
      setGenderNotice(
        `A peça "${item.name}" é exclusiva da Boutique VIP.`,
      );
      return;
    }

    soundEngine.playEquip();
    setPlayerState((prev) => {
      const currentInSlot = prev.equipped[item.category];
      const nextEquipped = { ...prev.equipped };
      if (currentInSlot === item.id) {
        delete nextEquipped[item.category];
      } else {
        nextEquipped[item.category] = item.id;
        if (item.category === 'vestidos') {
          delete nextEquipped.blusas;
          delete nextEquipped.calcas;
        } else if (item.category === 'blusas' || item.category === 'calcas') {
          delete nextEquipped.vestidos;
        }
      }
      return { ...prev, equipped: nextEquipped };
    });
  };

  const handleUnequipCategory = (category: ClothingCategory) => {
    soundEngine.playEquip();
    setPlayerState((prev) => {
      const nextEquipped = { ...prev.equipped };
      delete nextEquipped[category];
      return { ...prev, equipped: nextEquipped };
    });
  };

  const handleClearOutfit = () => {
    soundEngine.playEquip();
    setPlayerState((prev) => ({ ...prev, equipped: {} }));
  };

  const handleChangeSkinTone = (tone: SkinToneId) => {
    soundEngine.playEquip();
    setPlayerState((prev) => ({ ...prev, skinTone: tone }));
  };

  const handleChangeAvatarGender = (gender: AvatarGender) => {
    soundEngine.playEquip();
    if (genderNoticeTimerRef.current) {
      window.clearTimeout(genderNoticeTimerRef.current);
    }

    let removedList: string[] = [];
    setPlayerState((prev) => {
      const { nextEquipped, removedNames } = unequipIncompatibleClothes(
        prev.equipped,
        gender,
        fullClothingCatalog,
      );
      removedList = removedNames;
      return {
        ...prev,
        avatarGender: gender,
        equipped: nextEquipped,
      };
    });

    if (removedList.length > 0) {
      setGenderNotice(
        `Modelo alterado para ${gender}. Peças incompatíveis desequipadas automaticamente: ${removedList.join(', ')}.`,
      );
      genderNoticeTimerRef.current = window.setTimeout(() => {
        setGenderNotice(null);
      }, 4500);
    } else {
      setGenderNotice(null);
    }
  };

  // --- Handlers do Módulo 2: Starplaza ---
  const handleBuyItem = (item: ClothingItem) => {
    if (
      !isItemCompatibleWithGender(
        item.gender ?? item.genderStyle,
        playerState.avatarGender,
      )
    ) {
      return;
    }
    if (item.isVipOnly && !accountIsVip) {
      return;
    }

    setPlayerState((prev) => {
      if (prev.ownedItemIds.includes(item.id) || prev.starcoins < item.price) {
        return prev;
      }
      soundEngine.playPurchase();
      return {
        ...prev,
        starcoins: prev.starcoins - item.price,
        ownedItemIds: [...prev.ownedItemIds, item.id],
      };
    });
  };

  const handleClaimAllowance = () => {
    soundEngine.playPurchase();
    setPlayerState((prev) => ({
      ...prev,
      starcoins: prev.starcoins + 250,
    }));
  };

  const handleBuyFurniture = (furn: FurnitureDef) => {
    if (furn.isVipOnly && !accountIsVip) return;
    setPlayerState((prev) => {
      const owned = prev.ownedFurnitureIds ?? [];
      if (owned.includes(furn.id) || prev.starcoins < furn.price) {
        return prev;
      }
      soundEngine.playPurchase();
      return {
        ...prev,
        starcoins: prev.starcoins - furn.price,
        ownedFurnitureIds: [...owned, furn.id],
      };
    });
  };

  const handleBuyRoomTemplate = (roomTpl: PurchasableRoomItem) => {
    if (roomTpl.isVipOnly && !accountIsVip) return;
    setPlayerState((prev) => {
      const owned = prev.ownedRoomTemplateIds ?? [];
      if (owned.includes(roomTpl.id) || prev.starcoins < roomTpl.price) {
        return prev;
      }
      soundEngine.playPurchase();
      return {
        ...prev,
        starcoins: prev.starcoins - roomTpl.price,
        ownedRoomTemplateIds: [...owned, roomTpl.id],
      };
    });
  };

  const handleBuyWallpaper = (wp: PurchasableWallpaperItem) => {
    if (wp.isVipOnly && !accountIsVip) return;
    setPlayerState((prev) => {
      const owned = prev.ownedWallpaperIds ?? [];
      if (owned.includes(wp.id) || prev.starcoins < wp.price) {
        return prev;
      }
      soundEngine.playPurchase();
      return {
        ...prev,
        starcoins: prev.starcoins - wp.price,
        ownedWallpaperIds: [...owned, wp.id],
      };
    });
  };

  // --- Handlers do Módulo 3: Suíte 2D ---
  const handleUpdateSuite = (nextSuite: SuiteLayoutState, explicitSave?: boolean) => {
    if (explicitSave) {
      soundEngine.playPlaceFurniture();
    }
    setPlayerState((prev) => ({
      ...prev,
      suite: nextSuite,
    }));
  };

  // --- Handlers do Módulo 4: Mod Tools, Comunidade & Ateliê ---
  const handleUpdateNotice = (notice: string) => {
    if (!currentUser || !hasRolePermission(currentUser, ['admin'])) return;
    soundEngine.playModAction();
    setWorldState((prev) => ({
      ...prev,
      globalNotice: notice,
    }));
    void logStaffAction(
      currentUser.id,
      resolveCoreStaffRole(currentUser) ?? 'admin',
      'UPDATE_GLOBAL_NOTICE',
      'world_global_notice',
      `Aviso global atualizado: "${notice.slice(0, 120)}"`,
      currentUser.username,
    );
  };

  const handleUpdateServerNotice = (server: ServerRegion, notice: string) => {
    if (!currentUser || !canManageCommunityInServer(currentUser, server)) return;
    if (!hasRolePermission(currentUser, ['admin', 'cm'])) return;
    soundEngine.playModAction();
    setWorldState((prev) => ({
      ...prev,
      serverNotices: {
        ...(prev.serverNotices ?? {}),
        [server]: notice,
      },
    }));
    void logStaffAction(
      currentUser.id,
      resolveCoreStaffRole(currentUser) ?? 'cm',
      'UPDATE_SERVER_NOTICE',
      `server_${server}`,
      `Aviso regional (${server}) atualizado: "${notice.slice(0, 120)}"`,
      currentUser.username,
    );
  };

  const handleToggleBanUser = (userId: string, reason?: string) => {
    if (!currentUser || !hasRolePermission(currentUser, ['admin', 'moderator'])) return;
    const isAdminOwner = isPrimaryAdminAccount(currentUser);
    const modServer = getModeratorServer(currentUser);
    if (!isAdminOwner && !modServer) return;

    const target = worldState.users.find((u) => u.id === userId);
    if (!target) return;
    const targetAccount = getAccountByIdOrUsername(target.id, target.username);
    const isTargetOwnerOrStaff =
      Boolean(target.isPrimaryOwner) ||
      Boolean(targetAccount?.isPrimaryOwner) ||
      target.id === 'acc_admin_owner' ||
      target.role === 'admin' ||
      targetAccount?.role === 'admin';

    if (target.isPrimaryOwner || target.id === 'acc_admin_owner') return;
    if (!isAdminOwner && isTargetOwnerOrStaff) return;

    const targetServer: ServerRegion =
      target.serverRegion ??
      targetAccount?.serverRegion ??
      inferServerRegionFromCountry(target.countryCode);
    if (!isAdminOwner && !canBanInServer(currentUser, targetServer)) return;

    const willUnban = target.status === 'banned';
    const finalReason = reason?.trim() || `Violação das regras (${targetServer})`;

    soundEngine.playModAction();
    setWorldState((prev) => ({
      ...prev,
      users: prev.users.map((user) => {
        if (user.id !== userId) return user;
        if (user.status === 'banned') {
          return { ...user, status: 'active', banReason: undefined };
        }
        return {
          ...user,
          status: 'banned',
          banReason: finalReason,
        };
      }),
    }));

    void logStaffAction(
      currentUser.id,
      resolveCoreStaffRole(currentUser) ?? 'moderator',
      willUnban ? 'UNBAN_USER' : 'BAN_USER',
      target.id,
      willUnban
        ? `Desbaniu @${target.username} no servidor ${targetServer}`
        : `Baniu @${target.username} (${targetServer}) · Motivo: ${finalReason}`,
      currentUser.username,
    );
  };

  const handleToggleUserVip = (userId: string) => {
    if (!currentUser || !hasRolePermission(currentUser, ['admin'])) return;
    if (!isPrimaryAdminAccount(currentUser)) return;
    soundEngine.playPurchase();
    const nextWorld = toggleUserVipStatus(userId);
    setWorldState(nextWorld);
    const refreshedAcc = loadAccounts().find(
      (a) => a.id === currentUser?.id,
    );
    if (refreshedAcc) {
      setCurrentUser(refreshedAcc);
    }
    const targetUser = nextWorld.users.find((u) => u.id === userId);
    void logStaffAction(
      currentUser.id,
      'admin',
      'TOGGLE_VIP_STATUS',
      userId,
      `Alterou VIP de @${targetUser?.username ?? userId} para ${targetUser?.isVip ? 'ATIVO' : 'INATIVO'}`,
      currentUser.username,
    );
  };

  const handleCreateCustomClothing = (item: ClothingItem) => {
    if (!currentUser || !hasRolePermission(currentUser, ['admin', 'designer'])) return;
    soundEngine.playPurchase();
    setWorldState(addCustomClothingToWorld(item));
    void logStaffAction(
      currentUser.id,
      resolveCoreStaffRole(currentUser) ?? 'designer',
      'CREATE_CATALOG_CLOTHING',
      item.id,
      `Publicou roupa "${item.name}" (${item.category}, ${item.price} AM${item.isVipOnly ? ', VIP' : ''})`,
      currentUser.username,
    );
  };

  const handleCreateCustomFurniture = (furn: FurnitureDef) => {
    if (!currentUser || !hasRolePermission(currentUser, ['admin', 'designer'])) return;
    soundEngine.playPurchase();
    setWorldState(addCustomFurnitureToWorld(furn));
    void logStaffAction(
      currentUser.id,
      resolveCoreStaffRole(currentUser) ?? 'designer',
      'CREATE_CATALOG_FURNITURE',
      furn.id,
      `Publicou móvel "${furn.name}" (${furn.category}, ${furn.price} AM)`,
      currentUser.username,
    );
  };

  const handleCreateCustomRoomTemplate = (roomTpl: PurchasableRoomItem) => {
    if (!currentUser || !hasRolePermission(currentUser, ['admin', 'designer'])) return;
    soundEngine.playPurchase();
    setWorldState(addCustomRoomTemplateToWorld(roomTpl));
    void logStaffAction(
      currentUser.id,
      resolveCoreStaffRole(currentUser) ?? 'designer',
      'CREATE_ROOM_TEMPLATE',
      roomTpl.id,
      `Publicou modelo de sala "${roomTpl.name}" (${roomTpl.price} AM)`,
      currentUser.username,
    );
  };

  const handleCreateCustomWallpaper = (wp: PurchasableWallpaperItem) => {
    if (!currentUser || !hasRolePermission(currentUser, ['admin', 'designer'])) return;
    soundEngine.playPurchase();
    setWorldState(addCustomWallpaperToWorld(wp));
    void logStaffAction(
      currentUser.id,
      resolveCoreStaffRole(currentUser) ?? 'designer',
      'CREATE_WALLPAPER',
      wp.id,
      `Publicou papel de parede "${wp.name}" (${wp.price} AM)`,
      currentUser.username,
    );
  };

  const handleDeleteCatalogItem = (itemId: string) => {
    if (!currentUser || !isPrimaryAdminAccount(currentUser)) return;
    soundEngine.playModAction();
    setPlayerState((prev) => {
      const nextEquipped = { ...prev.equipped };
      (Object.keys(nextEquipped) as ClothingCategory[]).forEach((cat) => {
        if (nextEquipped[cat] === itemId) {
          delete nextEquipped[cat];
        }
      });
      return { ...prev, equipped: nextEquipped };
    });

    setWorldState((prev) => ({
      ...prev,
      deletedItemIds: prev.deletedItemIds.includes(itemId)
        ? prev.deletedItemIds
        : [...prev.deletedItemIds, itemId],
    }));

    void logStaffAction(
      currentUser.id,
      'admin',
      'DELETE_CATALOG_ITEM',
      itemId,
      `Removeu item ${itemId} do catálogo ativo`,
      currentUser.username,
    );
  };

  const handleRestoreAllItems = () => {
    if (!currentUser || !isPrimaryAdminAccount(currentUser)) return;
    soundEngine.playModAction();
    setWorldState((prev) => ({
      ...prev,
      deletedItemIds: [],
    }));
    void logStaffAction(
      currentUser.id,
      'admin',
      'RESTORE_CATALOG_ITEMS',
      'catalog_all',
      'Restaurou todos os itens removidos do catálogo',
      currentUser.username,
    );
  };

  const handleResetAllDemoData = () => {
    if (!currentUser || !isPrimaryAdminAccount(currentUser)) return;
    soundEngine.playModAction();
    const { player, world } = resetAccountAndWorld(currentUser);
    setPlayerState(player);
    setWorldState(world);
    void logStaffAction(
      currentUser.id,
      'admin',
      'RESET_WORLD_DATA',
      'world_state',
      'Restaurou dados base do mundo compartilhado',
      currentUser.username,
    );
  };

  const handleCreateStaffBot = (
    input: StaffBotEditorPayload,
  ): { ok: true } | { ok: false; error: string } => {
    if (!isPrimaryAdminAccount(currentUser)) {
      return { ok: false, error: 'Apenas o Administrador Geral pode criar membros na Staff.' };
    }
    const res = createStaffAccount(input);
    if (!res.ok) {
      soundEngine.playModAction();
      return res;
    }
    soundEngine.playPurchase();
    setWorldState(res.world);
    return { ok: true };
  };

  const handleUpdateStaffProfile = (
    accountId: string,
    input: StaffBotEditorPayload,
  ): { ok: true } | { ok: false; error: string } => {
    if (!isPrimaryAdminAccount(currentUser)) {
      return { ok: false, error: 'Apenas o Administrador Geral pode editar perfis da Staff.' };
    }
    const res = updateStaffProfileByAdmin(accountId, input);
    if (!res.ok) {
      soundEngine.playModAction();
      return res;
    }
    soundEngine.playPurchase();
    setWorldState(res.world);
    if (currentUser && res.account.id === currentUser.id) {
      setCurrentUser(res.account);
      setPlayerState(res.progress);
    }
    return { ok: true };
  };

  const handleRemoveStaffMember = (accountId: string) => {
    if (!isPrimaryAdminAccount(currentUser)) return;
    soundEngine.playModAction();
    const res = removeStaffMember(accountId);
    if (res.removed) {
      setWorldState(res.world);
    }
  };

  const handleAssignAccountStaffRole = (
    accountId: string,
    roleTier: StaffRoleTier | null,
    staffRoleTitle?: string,
  ) => {
    if (!isPrimaryAdminAccount(currentUser)) return;
    soundEngine.playModAction();
    const updated = updateAccountStaffAssignment(accountId, roleTier, staffRoleTitle);
    if (!updated) return;

    if (currentUser && updated.id === currentUser.id) {
      setCurrentUser(updated);
    }

    const cleanUsername = normalizeUsername(updated.username);
    setWorldState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === updated.id ||
        normalizeUsername(u.username) === cleanUsername
          ? {
              ...u,
              id: updated.id,
              username: cleanUsername,
              displayName: updated.displayName,
              role: updated.role,
              staffRoleTier: updated.staffRoleTier,
              serverRegion: updated.serverRegion,
              isVip: isVipAccount(updated),
              isPrimaryOwner: updated.isPrimaryOwner,
            }
          : u,
      ),
    }));
  };

  const handleAssignStaffRole = (user: MockUser, roleTier: StaffRoleTier | null) => {
    if (!isPrimaryAdminAccount(currentUser)) return;
    if (user.isPrimaryOwner || user.id === 'acc_admin_owner') return;
    soundEngine.playModAction();

    if (!roleTier) {
      const demoted = updateAccountStaffAssignment(
        user.id.startsWith('acc_') ? user.id : user.username,
        null,
      );
      if (demoted && currentUser && demoted.id === currentUser.id) {
        setCurrentUser(demoted);
      }

      setWorldState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === user.id ||
          normalizeUsername(u.username) === normalizeUsername(user.username)
            ? { ...u, role: 'player', staffRoleTier: undefined, serverRegion: u.serverRegion }
            : u,
        ),
      }));
      return;
    }

    const linkedAccount = ensureAccountForCommunityUser(user, roleTier);
    if (currentUser && linkedAccount.id === currentUser.id) {
      setCurrentUser(linkedAccount);
    }

    const cleanLinked = normalizeUsername(linkedAccount.username);
    setWorldState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === user.id ||
        normalizeUsername(u.username) === normalizeUsername(user.username)
          ? {
              ...u,
              id: linkedAccount.id,
              username: cleanLinked,
              displayName: linkedAccount.displayName,
              role: 'admin',
              staffRoleTier: roleTier,
              serverRegion: linkedAccount.serverRegion,
              isVip: isVipAccount(linkedAccount),
            }
          : u,
      ),
    }));
  };

  const handleAddBannedWord = (word: string) => {
    if (!isPrimaryAdminAccount(currentUser)) return;
    const cleaned = word.trim().toLowerCase();
    if (!cleaned) return;
    soundEngine.playModAction();
    setWorldState((prev) => ({
      ...prev,
      bannedWords: prev.bannedWords.includes(cleaned)
        ? prev.bannedWords
        : [...prev.bannedWords, cleaned],
    }));
  };

  const handleRemoveBannedWord = (word: string) => {
    if (!isPrimaryAdminAccount(currentUser)) return;
    soundEngine.playModAction();
    setWorldState((prev) => ({
      ...prev,
      bannedWords: prev.bannedWords.filter((w) => w !== word),
    }));
  };

  const handleStaffBanUsername = (
    username: string,
    reason?: string,
    targetServer: ServerRegion = 'BR',
  ): { ok: boolean; error?: string } => {
    if (!canBanInServer(currentUser, targetServer)) {
      return {
        ok: false,
        error: `Sem permissão de banimento no Servidor ${targetServer}.`,
      };
    }

    const target = normalizeUsername(username);
    const targetUser = worldState.users.find(
      (u) => normalizeUsername(u.username) === target,
    );
    const targetAccount = getAccountByIdOrUsername(targetUser?.id, target);

    if (!targetUser && !targetAccount) {
      return {
        ok: false,
        error: `Usuário "${target}" não encontrado.`,
      };
    }

    const isAdminOwner = isPrimaryAdminAccount(currentUser);
    const targetIsStaffOrOwner =
      Boolean(targetUser?.isPrimaryOwner) ||
      Boolean(targetAccount?.isPrimaryOwner) ||
      targetUser?.id === 'acc_admin_owner' ||
      targetUser?.role === 'admin' ||
      targetAccount?.role === 'admin';

    if (targetUser?.isPrimaryOwner || targetUser?.id === 'acc_admin_owner') {
      return { ok: false, error: 'A conta Fundadora não pode ser banida.' };
    }
    if (!isAdminOwner && targetIsStaffOrOwner) {
      return {
        ok: false,
        error: 'Moderadores regionais não podem banir membros da Staff.',
      };
    }

    soundEngine.playModAction();
    setWorldState((prev) => {
      const existsInWorld = prev.users.some(
        (u) => normalizeUsername(u.username) === target,
      );
      if (!existsInWorld && targetAccount) {
        const createdEntry: MockUser = {
          id: targetAccount.id,
          username: normalizeUsername(targetAccount.username),
          displayName: targetAccount.displayName,
          level: 1,
          starcoins: 1200,
          status: 'banned',
          banReason: reason?.trim() || `Banimento aplicado (${targetServer})`,
          joinedAt: targetAccount.createdAt,
          role: targetAccount.role,
          staffRoleTier: targetAccount.staffRoleTier,
          serverRegion: targetAccount.serverRegion ?? targetServer,
        };
        return { ...prev, users: [createdEntry, ...prev.users] };
      }

      return {
        ...prev,
        users: prev.users.map((u) =>
          normalizeUsername(u.username) === target
            ? {
                ...u,
                status: 'banned',
                banReason: reason?.trim() || `Banimento aplicado (${targetServer})`,
              }
            : u,
        ),
      };
    });

    if (currentUser) {
      void logStaffAction(
        currentUser.id,
        resolveCoreStaffRole(currentUser) ?? 'moderator',
        'CMD_BAN_USER',
        targetAccount?.id ?? target,
        `Baniu @${target} via comando/sala (${targetServer}) · Motivo: ${reason?.trim() || 'Violação'}`,
        currentUser.username,
      );
    }
    return { ok: true };
  };

  const handleSentinelModerationAction = (params: {
    bot: UserAccount;
    action: 'warning' | 'mute' | 'ban';
    targetUsername: string;
    reason: string;
    server: ServerRegion;
    muteUntil?: number;
    roomId: RoomId;
  }) => {
    const targetNorm = normalizeUsername(params.targetUsername);
    const targetAccount = getAccountByIdOrUsername(undefined, targetNorm);

    setWorldState((prev) => {
      const nextWarnings = {
        ...(prev.warningCounts ?? {}),
        [targetNorm]: ((prev.warningCounts ?? {})[targetNorm] ?? 0) + 1,
      };
      const nextMuted = { ...(prev.mutedUsers ?? {}) };
      let nextUsers = prev.users;

      if (params.action === 'mute') {
        nextMuted[targetNorm] = {
          until: params.muteUntil ?? Date.now() + 5 * 60_000,
          reason: params.reason,
          by: params.bot.displayName,
          server: params.server,
        };
      }

      if (params.action === 'ban') {
        const exists = prev.users.some((u) => normalizeUsername(u.username) === targetNorm);
        if (!exists && targetAccount) {
          const createdEntry: MockUser = {
            id: targetAccount.id,
            username: normalizeUsername(targetAccount.username),
            displayName: targetAccount.displayName,
            level: 1,
            starcoins: 1200,
            status: 'banned',
            banReason: params.reason,
            joinedAt: targetAccount.createdAt,
            role: targetAccount.role,
            staffRoleTier: targetAccount.staffRoleTier,
            serverRegion: targetAccount.serverRegion ?? params.server,
          };
          nextUsers = [createdEntry, ...prev.users];
        } else {
          nextUsers = prev.users.map((u) =>
            normalizeUsername(u.username) === targetNorm
              ? { ...u, status: 'banned', banReason: params.reason }
              : u,
          );
        }
      }

      return {
        ...prev,
        warningCounts: nextWarnings,
        mutedUsers: nextMuted,
        users: nextUsers,
      };
    });

    const logStatus =
      params.action === 'ban'
        ? 'banned'
        : params.action === 'mute'
          ? 'muted'
          : 'warning';
    const actionLabel =
      params.action === 'ban'
        ? `Mensagem bloqueada, conta ${targetNorm} banida no Servidor ${params.server}.`
        : params.action === 'mute'
          ? `Mensagem bloqueada e jogador ${targetNorm} silenciado por 5 minutos.`
          : `Mensagem bloqueada e advertência oficial aplicada a ${targetNorm}.`;

    const updatedLogs = appendAiLog({
      botId: params.bot.id,
      botName: params.bot.displayName,
      botUsername: params.bot.username,
      serverRegion: params.server,
      category: 'moderation',
      issueDetected: `Infração detectada no chat do Servidor ${params.server} por ${targetNorm}.`,
      actionTaken: `${actionLabel} (${params.reason})`,
      status: logStatus,
    });
    setAiLogs(updatedLogs);

    if (
      params.action === 'ban' &&
      currentUser &&
      normalizeUsername(currentUser.username) === targetNorm
    ) {
      setSentinelLockoutReason(params.reason);
    }
  };

  const handleSimulateSentinelChatTest = (input: {
    targetUserId: string;
    server: ServerRegion;
    sampleText: string;
  }): { ok: boolean; message: string } => {
    const targetUser = worldState.users.find((u) => u.id === input.targetUserId);
    if (!targetUser) {
      return { ok: false, message: 'Jogador alvo não encontrado.' };
    }

    const serverMainRoomId: RoomId =
      input.server === 'ES'
        ? 'salon_es'
        : input.server === 'EN'
          ? 'lounge_en'
          : 'lounge_party';

    const roomSnapshot = readRoomsSnapshot();
    const recentMsgs = roomSnapshot.messagesByRoom[serverMainRoomId] ?? [];
    const targetNorm = normalizeUsername(targetUser.username);
    const priorWarnings = (worldState.warningCounts ?? {})[targetNorm] ?? 0;

    const evalRes = evaluateMessageWithSentinelBot({
      text: input.sampleText,
      roomServer: input.server,
      senderUsername: targetNorm,
      bannedWords: worldState.bannedWords,
      recentRoomMessages: recentMsgs,
      priorWarnings,
    });

    if (
      !evalRes.triggered ||
      evalRes.action === 'none' ||
      !evalRes.bot ||
      !evalRes.publicChatNotice
    ) {
      return {
        ok: false,
        message: `Nenhuma infração detectada pelo Bot Sentinela (${input.server}) nesta mensagem, ou não há Bot Sentinela ativo para este servidor.`,
      };
    }

    soundEngine.playModAction();
    const ch = createRealtimeChannel();
    appendRoomMessage(
      serverMainRoomId,
      {
        id: `msg_bot_sim_${Date.now()}`,
        roomId: serverMainRoomId,
        senderUsername: evalRes.bot.displayName,
        senderRole: 'system',
        text: evalRes.publicChatNotice,
        createdAt: Date.now(),
      },
      null,
      ch,
    );
    ch?.close();

    handleSentinelModerationAction({
      bot: evalRes.bot,
      action: evalRes.action,
      targetUsername: targetNorm,
      reason: evalRes.reason ?? 'Infração detectada na simulação de chat',
      server: input.server,
      muteUntil: evalRes.muteUntil,
      roomId: serverMainRoomId,
    });

    return {
      ok: true,
      message: `${evalRes.publicChatNotice} Ação registrada no Log da IA.`,
    };
  };

  const handleReportFiled = () => {
    setWorldState(loadWorldState());
    setAiLogs(loadAiLogs());
  };

  const handleUploadProfilePhoto = (targetUid: string, dataUrl: string) => {
    if (!currentUser) return;
    const isOwner = currentUser.id === targetUid;
    const isAdminGeneral =
      currentUser.isPrimaryOwner ||
      currentUser.email === 'miranda88686673@gmail.com' ||
      (currentUser.role === 'admin' && currentUser.staffRoleTier === 'admin');
    if (!isOwner && !isAdminGeneral) {
      alert('Permissão negada para alterar a foto de perfil de outro usuário.');
      return;
    }
    soundEngine.playPurchase();
    const socket = getActiveSyncSocket();
    socket?.emit('user:update_profile_pic', {
      actorId: currentUser.id,
      targetUid,
      profilePic: dataUrl,
    });
    if (currentUser.id === targetUid) {
      setPlayerState((prev) => ({
        ...prev,
        profilePic: dataUrl,
        customAvatarUrl: dataUrl,
        avatarDisplayMode: 'photo',
      }));
    }
  };

  const handleRemoveProfilePhoto = (targetUid: string) => {
    if (!currentUser) return;
    const isOwner = currentUser.id === targetUid;
    const isAdminGeneral =
      currentUser.isPrimaryOwner ||
      currentUser.email === 'miranda88686673@gmail.com' ||
      (currentUser.role === 'admin' && currentUser.staffRoleTier === 'admin');
    if (!isOwner && !isAdminGeneral) {
      alert('Permissão negada para alterar a foto de perfil de outro usuário.');
      return;
    }
    soundEngine.playEquip();
    const socket = getActiveSyncSocket();
    socket?.emit('user:update_profile_pic', {
      actorId: currentUser.id,
      targetUid,
      profilePic: '',
    });
    if (currentUser.id === targetUid) {
      setPlayerState((prev) => ({
        ...prev,
        profilePic: undefined,
        customAvatarUrl: undefined,
        avatarDisplayMode: 'medoll',
      }));
    }
  };

  const handleChangeAvatarDisplayMode = (mode: AvatarDisplayMode) => {
    soundEngine.playEquip();
    setPlayerState((prev) => ({
      ...prev,
      avatarDisplayMode: mode,
    }));
  };

  const handleUpdateIdentity = (input: {
    username: string;
    displayName: string;
  }): { ok: true } | { ok: false; error: string } => {
    if (!currentUser) {
      return { ok: false, error: 'Nenhuma conta autenticada encontrada.' };
    }
    const result = updateAccountIdentity(currentUser.id, input);
    if (!result.ok) {
      soundEngine.playModAction();
      return result;
    }
    soundEngine.playPurchase();
    setCurrentUser(result.account);
    setPlayerState(result.progress);
    setWorldState(result.world);
    return { ok: true };
  };

  const handleUpdateProfileFields = (
    patch: Partial<
      Pick<
        PlayerProgressState,
        'bio' | 'presenceStatus' | 'countryCode' | 'timezone' | 'simulatedIp'
      >
    >,
  ) => {
    setPlayerState((prev) => ({
      ...prev,
      ...patch,
    }));

    if (!currentUser) return;

    if (patch.simulatedIp !== undefined || patch.countryCode !== undefined) {
      setWorldState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === currentUser.id ||
          normalizeUsername(u.username) === normalizeUsername(currentUser.username)
            ? {
                ...u,
                simulatedIp: patch.simulatedIp ?? u.simulatedIp,
                countryCode: patch.countryCode ?? u.countryCode,
              }
            : u,
        ),
      }));
    }
  };

  const handleOpenPublicProfile = (
    targetUsername: string,
    fallbackAppearance?: PublicProfileFallback,
  ) => {
    const cleaned = normalizeUsername(targetUsername);
    if (!cleaned) return;
    soundEngine.playEquip();
    setPublicProfileTarget({ username: cleaned, fallbackAppearance });
  };

  const handleToggleFriend = (targetUsername: string) => {
    const normalized = normalizeUsername(targetUsername);
    soundEngine.playPurchase();
    setPlayerState((prev) => {
      const currentFriends = prev.friendUsernames ?? [];
      const exists = currentFriends.includes(normalized);
      return {
        ...prev,
        friendUsernames: exists
          ? currentFriends.filter((f) => f !== normalized)
          : [...currentFriends, normalized],
      };
    });
  };

  const handleVisitSuiteFromProfile = (profile: PublicProfileSummary) => {
    soundEngine.playEquip();
    if (
      currentUser &&
      normalizeUsername(profile.username) === normalizeUsername(currentUser.username)
    ) {
      setVisitingSuiteProfile(null);
      setActiveTab('suite');
      return;
    }
    setVisitingSuiteProfile(profile);
    setActiveTab('suite');
  };

  if (!currentUser) {
    return <LoginModal onAuthenticated={handleAuthenticated} />;
  }

  const resolvedVisitorProfile = publicProfileTarget
    ? resolvePublicProfileSummary({
        targetUsername: publicProfileTarget.username,
        currentUser,
        currentPlayerState: playerState,
        worldState,
        fallbackAppearance: publicProfileTarget.fallbackAppearance,
      })
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917]">
      {/* Cabeçalho Principal: 3 zonas (Marca | Navegação | Usuário + Insígnia + Sair) */}
      <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-[#E6E0D8]">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setVisitingSuiteProfile(null);
              setActiveTab('medoll');
            }}
            className="font-display text-2xl font-bold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0"
          >
            Starlight Atelier
          </a>

          <nav
            aria-label="Módulos do jogo"
            className="flex items-center gap-4 sm:gap-5 overflow-x-auto"
          >
            {navItems.map((nav) => {
              const isActive = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => {
                    if (nav.id === 'suite') {
                      setVisitingSuiteProfile(null);
                    }
                    setActiveTab(nav.id);
                  }}
                  className={`py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-[#C8235D] text-[#1C1917]'
                      : 'border-transparent text-[#6B645D] hover:text-[#1C1917]'
                  }`}
                >
                  {nav.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('perfil')}
              title="Abrir Meu Perfil / Conta"
              className="hidden md:flex items-center gap-2 text-xs text-[#44403C] hover:text-[#1C1917] whitespace-nowrap cursor-pointer"
            >
              <div className="relative">
                <ProfileAvatar
                  username={currentUser.username}
                  equipped={playerState.equipped}
                  skinTone={playerState.skinTone}
                  avatarGender={playerState.avatarGender}
                  customAvatarUrl={playerState.customAvatarUrl}
                  avatarDisplayMode={playerState.avatarDisplayMode}
                  deletedItemIds={worldState.deletedItemIds}
                  sizeClass="w-8 h-8"
                  roundedClass="rounded-lg"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${PRESENCE_META[playerState.presenceStatus].dotClass}`}
                  title={`Presença: ${PRESENCE_META[playerState.presenceStatus].label}`}
                />
              </div>
              <span className="font-semibold text-[#1C1917]">
                {currentUser.displayName !== currentUser.username
                  ? `${currentUser.displayName} (${currentUser.username})`
                  : currentUser.username}
              </span>
              {currentUser.staffRoleTier && (
                <StaffRoleBadge tier={currentUser.staffRoleTier} compact />
              )}
              {accountIsVip && <VipBadge compact />}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1C1917] bg-[#F5F2EC] hover:bg-[#EAE4DA] border border-[#DFD8CE] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Barra de HUD da Sala */}
      <div className="border-b border-[#EFEAE3] bg-white">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {worldState.globalNotice ? (
              <>
                <Megaphone className="w-4 h-4 text-[#C8235D] shrink-0" />
                <p className="text-xs text-[#44403C] truncate">
                  <strong className="font-semibold text-[#1C1917]">Aviso da Sala:</strong>{' '}
                  {worldState.globalNotice}
                </p>
              </>
            ) : (
              <p className="text-xs text-[#78716C]">
                Sala aberta · Nenhum aviso global publicado no momento
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
              <Coins className="w-4 h-4 text-[#C6922B]" />
              <span className="font-mono-num">
                {playerState.starcoins.toLocaleString('pt-BR')} AM
              </span>
            </div>

            <button
              type="button"
              onClick={handleClaimAllowance}
              className="text-xs font-semibold text-[#C8235D] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              +250 AM
            </button>

            <button
              type="button"
              onClick={handleToggleSound}
              aria-label={isMuted ? 'Ativar efeitos sonoros' : 'Silenciar efeitos sonoros'}
              title={isMuted ? 'Ativar som' : 'Silenciar som'}
              className="inline-flex items-center gap-1 text-xs text-[#57534E] hover:text-[#1C1917] transition-colors cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              <span className="hidden md:inline">{isMuted ? 'Sem som' : 'Som ativo'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal do Módulo Ativo */}
      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'perfil' && (
          <ProfileAccountView
            account={currentUser}
            playerState={playerState}
            deletedItemIds={worldState.deletedItemIds}
            onUpdateIdentity={handleUpdateIdentity}
            onUpdateProfileFields={handleUpdateProfileFields}
            onUploadProfilePhoto={handleUploadProfilePhoto}
            onRemoveProfilePhoto={handleRemoveProfilePhoto}
            onChangeAvatarDisplayMode={handleChangeAvatarDisplayMode}
            onGoToMeDoll={() => setActiveTab('medoll')}
            onGoToSuite={() => setActiveTab('suite')}
          />
        )}

        {activeTab === 'medoll' && (
          <MeDollStudio
            catalog={fullClothingCatalog}
            ownedItemIds={playerState.ownedItemIds}
            equipped={playerState.equipped}
            skinTone={playerState.skinTone}
            avatarGender={playerState.avatarGender}
            deletedItemIds={worldState.deletedItemIds}
            isAccountVip={accountIsVip}
            genderNotice={genderNotice}
            onToggleEquip={handleToggleEquip}
            onUnequipCategory={handleUnequipCategory}
            onClearOutfit={handleClearOutfit}
            onChangeSkinTone={handleChangeSkinTone}
            onChangeAvatarGender={handleChangeAvatarGender}
            onGoToShop={() => setActiveTab('starplaza')}
            onGoToProfile={() => setActiveTab('perfil')}
          />
        )}

        {activeTab === 'starplaza' && (
          <StarplazaShop
            catalog={fullClothingCatalog}
            furnitureCatalog={fullFurnitureCatalog}
            roomCatalog={fullRoomCatalog}
            wallpaperCatalog={fullWallpaperCatalog}
            ownedItemIds={playerState.ownedItemIds}
            ownedFurnitureIds={playerState.ownedFurnitureIds ?? []}
            ownedRoomTemplateIds={playerState.ownedRoomTemplateIds ?? []}
            ownedWallpaperIds={playerState.ownedWallpaperIds ?? []}
            equipped={playerState.equipped}
            deletedItemIds={worldState.deletedItemIds}
            starcoins={playerState.starcoins}
            isAccountVip={accountIsVip}
            bodyGender={playerState.avatarGender}
            onBuyItem={handleBuyItem}
            onBuyFurniture={handleBuyFurniture}
            onBuyRoomTemplate={handleBuyRoomTemplate}
            onBuyWallpaper={handleBuyWallpaper}
            onEquipFromShop={handleToggleEquip}
            onClaimAllowance={handleClaimAllowance}
            onGoToVipStore={() => setActiveTab('vip_loja')}
            onGoToSuite={() => {
              setVisitingSuiteProfile(null);
              setActiveTab('suite');
            }}
            onGoToRooms={() => setActiveTab('salas')}
          />
        )}

        {activeTab === 'suite' && (
          <SuiteRoom
            username={currentUser.username}
            suite={playerState.suite}
            catalog={fullClothingCatalog}
            furnitureCatalog={fullFurnitureCatalog}
            wallpaperCatalog={fullWallpaperCatalog}
            ownedItemIds={playerState.ownedItemIds}
            ownedFurnitureIds={playerState.ownedFurnitureIds ?? []}
            ownedWallpaperIds={playerState.ownedWallpaperIds ?? []}
            equipped={playerState.equipped}
            skinTone={playerState.skinTone}
            avatarGender={playerState.avatarGender}
            deletedItemIds={worldState.deletedItemIds}
            isAccountVip={accountIsVip}
            visitingProfile={visitingSuiteProfile}
            onExitVisit={() => setVisitingSuiteProfile(null)}
            onOpenHostProfile={(profile) =>
              handleOpenPublicProfile(profile.username, {
                equipped: profile.equipped,
                skinTone: profile.skinTone,
                avatarGender: profile.avatarGender,
                customAvatarUrl: profile.customAvatarUrl,
                avatarDisplayMode: profile.avatarDisplayMode,
                role: profile.role,
              })
            }
            onUpdateSuite={handleUpdateSuite}
            onToggleEquip={handleToggleEquip}
            onChangeSkinTone={handleChangeSkinTone}
            onClearOutfit={handleClearOutfit}
            onGoToShop={() => setActiveTab('starplaza')}
          />
        )}

        {activeTab === 'salas' && (
          <RoomView
            currentUser={currentUser}
            playerState={playerState}
            deletedItemIds={worldState.deletedItemIds}
            bannedWords={worldState.bannedWords}
            users={worldState.users}
            serverNotices={worldState.serverNotices}
            mutedUsers={worldState.mutedUsers}
            warningCounts={worldState.warningCounts}
            roomCatalog={fullRoomCatalog}
            wallpaperCatalog={fullWallpaperCatalog}
            ownedRoomTemplateIds={playerState.ownedRoomTemplateIds ?? []}
            ownedWallpaperIds={playerState.ownedWallpaperIds ?? []}
            onGoToShop={() => setActiveTab('starplaza')}
            onStaffNotice={handleUpdateNotice}
            onUpdateServerNotice={handleUpdateServerNotice}
            onStaffBanUsername={handleStaffBanUsername}
            onSentinelModerationAction={handleSentinelModerationAction}
            onReportFiled={handleReportFiled}
            onOpenStaffDesk={(deskTab) => {
              setStaffSubTab(deskTab);
              setActiveTab('modtools');
            }}
            onOpenPublicProfile={handleOpenPublicProfile}
          />
        )}

        {activeTab === 'noticias' && (
          <NewsFeedView
            posts={worldState.newsPosts ?? []}
            currentUser={currentUser}
            onPublishPost={publishNewsPost}
            onOpenPublicProfile={(uname) => handleOpenPublicProfile(uname)}
            onGoToShop={() => setActiveTab('starplaza')}
            onGoToVipStore={() => setActiveTab('vip_loja')}
          />
        )}

        {activeTab === 'vip_loja' && (
          <VipCoinsStoreView
            currentUser={currentUser}
            starcoins={playerState.starcoins}
            isAccountVip={accountIsVip}
            legendaryCatalog={fullClothingCatalog}
            onGoToStarplaza={() => setActiveTab('starplaza')}
          />
        )}

        {activeTab === 'modtools' && (
          <ModPanel
            currentUser={currentUser}
            initialSubTab={staffSubTab}
            liveUserProfile={{
              accountId: currentUser.id,
              username: currentUser.username,
              displayName: currentUser.displayName,
              playerState,
            }}
            globalNotice={worldState.globalNotice}
            users={worldState.users}
            deletedItemIds={worldState.deletedItemIds}
            bannedWords={worldState.bannedWords}
            reports={worldState.reports}
            customClothingCatalog={worldState.customClothingCatalog}
            customFurnitureCatalog={worldState.customFurnitureCatalog}
            onUpdateNotice={handleUpdateNotice}
            onToggleBanUser={handleToggleBanUser}
            onToggleUserVip={handleToggleUserVip}
            onAssignStaffRole={handleAssignStaffRole}
            onAssignAccountStaffRole={handleAssignAccountStaffRole}
            onCreateCustomClothing={handleCreateCustomClothing}
            onCreateCustomFurniture={handleCreateCustomFurniture}
            onCreateCustomRoomTemplate={handleCreateCustomRoomTemplate}
            onCreateCustomWallpaper={handleCreateCustomWallpaper}
            onCreateStaffBot={handleCreateStaffBot}
            onUpdateStaffProfile={handleUpdateStaffProfile}
            onRemoveStaffMember={handleRemoveStaffMember}
            onDeleteCatalogItem={handleDeleteCatalogItem}
            onRestoreAllItems={handleRestoreAllItems}
            onResetAllDemoData={handleResetAllDemoData}
            onAddBannedWord={handleAddBannedWord}
            onRemoveBannedWord={handleRemoveBannedWord}
            onGoToMyProfile={() => setActiveTab('perfil')}
            onOpenPublicProfile={handleOpenPublicProfile}
            onUploadProfilePhoto={handleUploadProfilePhoto}
            onRemoveProfilePhoto={handleRemoveProfilePhoto}
            onSimulateSentinelChatTest={handleSimulateSentinelChatTest}
          />
        )}
      </main>

      {/* Bloqueio imediato caso a conta seja banida ao vivo pela moderação automática */}
      {sentinelLockoutReason && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Conta suspensa pela moderação automática"
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#FECACA] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-display text-2xl font-bold text-[#B91C1C]">
              Conta Suspensa pela Moderação Automática
            </h3>
            <p className="text-xs text-[#44403C] leading-relaxed">
              A moderação automática do chat interceptou sua mensagem, bloqueou o envio e aplicou suspensão na sua conta ({currentUser.username}).
            </p>
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
              <strong>Motivo registrado:</strong> {sentinelLockoutReason}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg transition-colors cursor-pointer"
              >
                Voltar para a Tela de Login
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Global de Perfil Público Visitante */}
      {resolvedVisitorProfile && (
        <VisitorProfileModal
          profile={resolvedVisitorProfile}
          currentUser={currentUser}
          deletedItemIds={worldState.deletedItemIds}
          isFriend={(playerState.friendUsernames ?? []).includes(
            normalizeUsername(resolvedVisitorProfile.username),
          )}
          onToggleFriend={handleToggleFriend}
          onVisitSuite={handleVisitSuiteFromProfile}
          onClose={() => setPublicProfileTarget(null)}
        />
      )}
    </div>
  );
}
