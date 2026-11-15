import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AiMaintenanceLogEntry,
  ClothingItem,
  FurnitureDef,
  NewsPost,
  PlayerProgressState,
  PurchasableRoomItem,
  PurchasableWallpaperItem,
  UserAccount,
  WorldModerationState,
} from '../types/game';
import {
  subscribeRemoteSync,
} from '../core/state/socketBridge';
import { useGlobalState } from '../core/state/GlobalStateManager';
import {
  AI_LOGS_KEY,
  loadAiLogs,
} from '../utils/aiBots';
import { createRealtimeChannel } from '../utils/realtime';
import { soundEngine } from '../utils/sound';
import {
  ACCOUNTS_KEY,
  PLAYER_PREFIX,
  WORLD_KEY,
  activateUserVipSubscription,
  creditUserStarcoins,
  getFullClothingCatalog,
  getFullFurnitureCatalog,
  getFullRoomCatalog,
  getFullWallpaperCatalog,
  getLoggedAccount,
  isVipAccount,
  loadPlayerProgress,
  loadWorldState,
  publishNewsPostToWorld,
  savePlayerProgress,
  saveWorldState,
} from '../utils/storage';

interface GameRealtimeContextValue {
  currentUser: UserAccount | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserAccount | null>>;
  playerState: PlayerProgressState;
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerProgressState>>;
  worldState: WorldModerationState;
  setWorldState: React.Dispatch<React.SetStateAction<WorldModerationState>>;
  aiLogs: AiMaintenanceLogEntry[];
  setAiLogs: React.Dispatch<React.SetStateAction<AiMaintenanceLogEntry[]>>;
  fullClothingCatalog: ClothingItem[];
  fullFurnitureCatalog: FurnitureDef[];
  fullRoomCatalog: PurchasableRoomItem[];
  fullWallpaperCatalog: PurchasableWallpaperItem[];
  accountIsVip: boolean;
  buyStarcoinsPackage: (amount: number) => void;
  activateVipPlan: (bonusStarcoins: number) => void;
  publishNewsPost: (input: Omit<NewsPost, 'id' | 'createdAt'>) => NewsPost;
}

const GameRealtimeContext = createContext<GameRealtimeContextValue | null>(null);

export const GameRealtimeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    myLifecycleStatus,
    bindHeartbeatUser,
    refreshStaffAuditLogs,
  } = useGlobalState();

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() =>
    getLoggedAccount(),
  );
  const [playerState, setPlayerState] = useState<PlayerProgressState>(() => {
    const logged = getLoggedAccount();
    return loadPlayerProgress(
      logged?.id ?? 'guest',
      logged?.avatarGender ?? 'feminino',
    );
  });
  const [worldState, setWorldState] = useState<WorldModerationState>(() =>
    loadWorldState(),
  );
  const [aiLogs, setAiLogs] = useState<AiMaintenanceLogEntry[]>(() => loadAiLogs());

  const fullClothingCatalog = useMemo(
    () => getFullClothingCatalog(worldState),
    [worldState],
  );
  const fullFurnitureCatalog = useMemo(
    () => getFullFurnitureCatalog(worldState),
    [worldState],
  );
  const fullRoomCatalog = useMemo(
    () => getFullRoomCatalog(worldState),
    [worldState],
  );
  const fullWallpaperCatalog = useMemo(
    () => getFullWallpaperCatalog(worldState),
    [worldState],
  );
  const accountIsVip = isVipAccount(currentUser);

  // Vincula o usuário autenticado ao sistema de Presença (Heartbeat) e carrega logs de auditoria se Staff
  useEffect(() => {
    const manualOffline = playerState.presenceStatus === 'offline';
    bindHeartbeatUser(currentUser, manualOffline);
    if (currentUser && (currentUser.role === 'admin' || currentUser.staffRoleTier)) {
      void refreshStaffAuditLogs(currentUser);
    }
  }, [currentUser, playerState.presenceStatus, bindHeartbeatUser, refreshStaffAuditLogs]);

  // Reflete transições automáticas do Heartbeat (online < 3min / away > 3min) no perfil vivo
  useEffect(() => {
    if (!currentUser) return;
    if (playerState.presenceStatus === 'offline') return;
    const expectedPresence = myLifecycleStatus === 'away' ? 'ausente' : 'online';
    if (playerState.presenceStatus !== expectedPresence) {
      setPlayerState((prev) =>
        prev.presenceStatus === 'offline' || prev.presenceStatus === expectedPresence
          ? prev
          : { ...prev, presenceStatus: expectedPresence },
      );
    }
  }, [currentUser, myLifecycleStatus, playerState.presenceStatus]);

  // Persistência com verificação anti-eco em storage.ts + sync automático via Socket.io
  useEffect(() => {
    if (currentUser) {
      savePlayerProgress(currentUser.id, playerState);
    }
  }, [currentUser, playerState]);

  useEffect(() => {
    saveWorldState(worldState);
  }, [worldState]);

  // Sincronização em tempo real (Socket.io Server + StorageEvent + BroadcastChannel)
  useEffect(() => {
    const syncPlayerIfMatches = (targetAccountId?: string) => {
      if (!currentUser) return;
      if (!targetAccountId || targetAccountId === currentUser.id) {
        setPlayerState(loadPlayerProgress(currentUser.id, currentUser.avatarGender));
      }
    };

    const unsubscribeSocket = subscribeRemoteSync({
      onInit: () => {
        setWorldState(loadWorldState());
        setAiLogs(loadAiLogs());
        const refreshed = getLoggedAccount();
        if (refreshed) {
          setCurrentUser(refreshed);
          setPlayerState(loadPlayerProgress(refreshed.id, refreshed.avatarGender));
        }
      },
      onPatch: (patch) => {
        if (patch.worldState) {
          setWorldState(loadWorldState());
        }
        if (patch.aiLogs) {
          setAiLogs(loadAiLogs());
        }
        if (patch.accounts) {
          const refreshed = getLoggedAccount();
          if (refreshed) {
            setCurrentUser(refreshed);
          }
        }
        if (patch.playerPatch && currentUser && patch.playerPatch.accountId === currentUser.id) {
          syncPlayerIfMatches(currentUser.id);
        }
      },
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key === WORLD_KEY) {
        setWorldState(loadWorldState());
      } else if (e.key === AI_LOGS_KEY) {
        setAiLogs(loadAiLogs());
      } else if (e.key === ACCOUNTS_KEY) {
        const refreshed = getLoggedAccount();
        if (refreshed) {
          setCurrentUser(refreshed);
        }
      } else if (
        currentUser &&
        e.key === `${PLAYER_PREFIX}${currentUser.id}`
      ) {
        syncPlayerIfMatches(currentUser.id);
      }
    };
    window.addEventListener('storage', onStorage);

    const channel = createRealtimeChannel();
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === 'ai_logs:sync') {
          setAiLogs(loadAiLogs());
        } else if (event.data?.type === 'world:sync') {
          setWorldState(loadWorldState());
        } else if (event.data?.type === 'accounts:sync') {
          const refreshed = getLoggedAccount();
          if (refreshed) {
            setCurrentUser(refreshed);
          }
        } else if (event.data?.type === 'player:sync') {
          syncPlayerIfMatches(event.data.accountId);
        }
      };
    }

    return () => {
      unsubscribeSocket();
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, [currentUser?.id, currentUser?.avatarGender]);

  const buyStarcoinsPackage = useCallback(
    (amount: number) => {
      if (!currentUser) return;
      soundEngine.playPurchase();
      const res = creditUserStarcoins(currentUser.id, amount);
      setPlayerState(res.progress);
      setWorldState(res.world);
    },
    [currentUser],
  );

  const activateVipPlan = useCallback(
    (bonusStarcoins: number) => {
      if (!currentUser) return;
      soundEngine.playPurchase();
      const res = activateUserVipSubscription(currentUser.id, bonusStarcoins);
      if (res.account) {
        setCurrentUser(res.account);
      }
      setPlayerState(res.progress);
      setWorldState(res.world);
    },
    [currentUser],
  );

  const publishNewsPost = useCallback(
    (input: Omit<NewsPost, 'id' | 'createdAt'>) => {
      const res = publishNewsPostToWorld(input);
      setWorldState(res.world);
      return res.post;
    },
    [],
  );

  const value = useMemo<GameRealtimeContextValue>(
    () => ({
      currentUser,
      setCurrentUser,
      playerState,
      setPlayerState,
      worldState,
      setWorldState,
      aiLogs,
      setAiLogs,
      fullClothingCatalog,
      fullFurnitureCatalog,
      fullRoomCatalog,
      fullWallpaperCatalog,
      accountIsVip,
      buyStarcoinsPackage,
      activateVipPlan,
      publishNewsPost,
    }),
    [
      currentUser,
      playerState,
      worldState,
      aiLogs,
      fullClothingCatalog,
      fullFurnitureCatalog,
      fullRoomCatalog,
      fullWallpaperCatalog,
      accountIsVip,
      buyStarcoinsPackage,
      activateVipPlan,
      publishNewsPost,
    ],
  );

  return (
    <GameRealtimeContext.Provider value={value}>
      {children}
    </GameRealtimeContext.Provider>
  );
};

export function useGameRealtime(): GameRealtimeContextValue {
  const ctx = useContext(GameRealtimeContext);
  if (!ctx) {
    throw new Error('useGameRealtime deve ser usado dentro de GameRealtimeProvider.');
  }
  return ctx;
}
