/**
 * Definição central de tipos do Starlight Atelier.
 * Todos os módulos (Perfil, MeDoll, Starplaza, Suíte, Salas e Moderação) compartilham estas interfaces.
 */

export type GameTab =
  | 'perfil'
  | 'medoll'
  | 'starplaza'
  | 'suite'
  | 'salas'
  | 'noticias'
  | 'vip_loja'
  | 'modtools';

/** Categorias de vestuário suportadas pelo sistema de camadas da MeDoll */
export type ClothingCategory =
  | 'cabelo'
  | 'blusas'
  | 'vestidos'
  | 'calcas'
  | 'sapatos'
  | 'acessorios';

/** Ordem fixa de empilhamento (z-index) para garantir encaixe perfeito sobre a boneca base */
export const LAYER_Z_INDEX: Record<ClothingCategory, number> = {
  sapatos: 20,
  calcas: 30,
  blusas: 40,
  vestidos: 42,
  cabelo: 50,
  acessorios: 60,
};

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  cabelo: 'Cabelo',
  blusas: 'Blusas & Jaquetas',
  vestidos: 'Vestidos',
  calcas: 'Calças & Saias',
  sapatos: 'Sapatos',
  acessorios: 'Acessórios',
};

/** Público/estilo principal da peça na Starplaza e Guarda-Roupa */
export type ItemGenderStyle = 'feminino' | 'masculino' | 'unissex';

/** Padrões têxteis e acabamentos visuais aplicados a roupas, móveis e papéis de parede */
export type DesignPattern =
  | 'solid'
  | 'striped'
  | 'plaid'
  | 'floral'
  | 'sequin'
  | 'denim'
  | 'neon';

/** Temáticas arquitetônicas de móveis, salas e papéis de parede */
export type RoomThemeCategory = 'geral' | 'boate' | 'casa' | 'bar' | 'hotel';

/** Identificadores anatômicos dos ossos do Esqueleto Modular v2.1 */
export type RigBoneId =
  | 'head'
  | 'neck'
  | 'torso'
  | 'pelvis'
  | 'left_upper_arm'
  | 'left_forearm'
  | 'right_upper_arm'
  | 'right_forearm'
  | 'left_thigh'
  | 'left_calf'
  | 'right_thigh'
  | 'right_calf'
  | 'left_foot'
  | 'right_foot';

/** Zonas oficiais de sobreposição de camadas da folha anatômica v2.1 */
export type OverlapZoneId =
  | 'zone_hair_crown'
  | 'zone_face_accessories'
  | 'zone_upper_garment'
  | 'zone_full_dress'
  | 'zone_lower_garment'
  | 'zone_footwear'
  | 'zone_hand_wrist_accessory';

/** Metadados de indexação anatômica vinculados ao esqueleto modular v2.1 */
export interface ClothingRigMetadata {
  rigSpecVersion: '2.1';
  primaryBone: RigBoneId;
  attachedBones: RigBoneId[];
  overlapZone: OverlapZoneId;
  overlapZoneLabel: string;
  anchorOrigin: { x: number; y: number };
  bounds280x520: { x: number; y: number; width: number; height: number };
}

/** Representa uma peça de roupa ou acessório do catálogo */
export interface ClothingItem {
  id: string;
  name: string;
  brand: string;
  category: ClothingCategory;
  /** Gênero obrigatório da peça para filtragem e compatibilidade anatômica */
  gender: ItemGenderStyle;
  /** Alias mantido para compatibilidade retroativa com referências legadas */
  genderStyle?: ItemGenderStyle;
  price: number;
  zIndex: number;
  /** Define se a peça já vem desbloqueada no guarda-roupa inicial */
  starter?: boolean;
  /** Define se a peça é exclusiva da Boutique VIP */
  isVipOnly?: boolean;
  /** Define se a peça pertence à raridade Lendária VIP de alto luxo */
  isLegendary?: boolean;
  /** Modelo visual usado para peças criadas pelo Ateliê / Designer Global */
  templateId?: string;
  /** Coleção ou tendência de moda (ex: Streetwear, Alta Costura, Y2K, Casual Chic) */
  collectionTag?: string;
  /** Cor principal de destaque usada na miniatura e renderização vetorial */
  swatchColor: string;
  /** Cor secundária (lapelas, punhos, detalhes de acabamento) */
  secondaryColor?: string;
  /** Cor de destaque metálico, neon ou costura */
  accentColor?: string;
  /** Padrão visual de tecido */
  pattern?: DesignPattern;
  /** Descrição editorial ou de material da peça */
  description?: string;
  /** Indica se a peça foi criada por clonagem de foto real via Gemini Vision */
  aiGeneratedFromPhoto?: boolean;
  /** Data URL / caminho de imagem PNG transparente modular para camada 2D */
  customLayerPngUrl?: string;
  /** Ajuste horizontal (px no viewBox 280x520) da camada PNG sobre o manequim */
  layerOffsetX?: number;
  /** Ajuste vertical (px no viewBox 280x520) da camada PNG sobre o manequim */
  layerOffsetY?: number;
  /** Fator de escala da camada PNG (padrão 1.0) */
  layerScale?: number;
  /** Caixa de recorte dedicada para vitrines da Starplaza e Guarda-Roupa */
  crop_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** URL ou DataURL dedicada de miniatura isolada para vitrine */
  thumbnail_url?: string;
  /** Indexação vinculada aos ossos e zonas de sobreposição do esqueleto modular v2.1 */
  rigMetadata?: ClothingRigMetadata;
  /** Metadados opcionais de autoria/edição do Designer Global */
  collection?: string;
  vip?: boolean;
  badge?: string;
  createdBy?: string;
  customCreatedAt?: number;
}

/** Mapa de peças atualmente vestidas na MeDoll (1 peça por categoria) */
export type EquippedOutfit = Partial<Record<ClothingCategory, string>>;

/** Tons de pele disponíveis para personalização da MeDoll base */
export type SkinToneId = 'porcelana' | 'pessego' | 'mel' | 'cacau';

export interface SkinToneOption {
  id: SkinToneId;
  label: string;
  base: string;
  shadow: string;
  blush: string;
}

export type FurnitureTemplateId =
  | 'tpl_sofa'
  | 'tpl_mesa'
  | 'tpl_decoracao'
  | 'tpl_dj'
  | 'tpl_pista'
  | 'tpl_bar'
  | 'tpl_banqueta'
  | 'tpl_cama'
  | 'tpl_cozinha'
  | 'tpl_banheira'
  | 'tpl_lustre';

/** Definição de um móvel disponível para decorar a Suíte 2D */
export interface FurnitureDef {
  id: string;
  name: string;
  category: 'Assentos' | 'Superfícies' | 'Decoração';
  /** Tema arquitetônico (Boate, Casa, Bar, Hotel ou Geral) */
  themeTag?: RoomThemeCategory;
  width: number;
  height: number;
  /** Preço em Starcoins */
  price: number;
  /** Ordem padrão sugerida ao inserir na sala */
  defaultZ: number;
  /** Define se o móvel faz parte do conjunto inicial da Suíte */
  starter?: boolean;
  /** Define se o móvel é exclusivo para contas VIP */
  isVipOnly?: boolean;
  /** Define se o móvel pertence à coleção Lendária VIP */
  isLegendary?: boolean;
  /** Cor de destaque para móveis */
  swatchColor?: string;
  /** Cor secundária estrutural */
  secondaryColor?: string;
  /** Cor de brilho/metais */
  accentColor?: string;
  /** Padrão decorativo */
  pattern?: DesignPattern;
  /** Descrição do móvel */
  description?: string;
  /** Modelo estrutural usado para renderização dinâmica */
  templateId?: FurnitureTemplateId;
  /** Indica se foi criado a partir de foto real via Gemini Vision */
  aiGeneratedFromPhoto?: boolean;
}

/** Modelo de Sala Comum ou Sala Exclusiva VIP vendida na Starplaza */
export interface PurchasableRoomItem {
  id: string;
  name: string;
  subtitle: string;
  themeTag: RoomThemeCategory;
  backdropTheme: RoomBackdropTheme;
  price: number;
  isVipOnly?: boolean;
  isLegendary?: boolean;
  starter?: boolean;
  accentColor: string;
  secondaryColor: string;
  walkMinY: number;
  walkMaxY: number;
}

/** Papel de parede / Plano de fundo arquitetônico aplicável em Suítes e Salas */
export interface PurchasableWallpaperItem {
  id: string;
  name: string;
  subtitle: string;
  themeTag: RoomThemeCategory;
  price: number;
  isVipOnly?: boolean;
  starter?: boolean;
  wallTopColor: string;
  wallBottomColor: string;
  wainscotColor: string;
  floorTopColor: string;
  floorBottomColor: string;
  accentColor: string;
  pattern?: DesignPattern;
  description?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

/** Instância de um móvel posicionado dentro da Suíte (salvo no localStorage) */
export interface PlacedFurniture {
  instanceId: string;
  furnitureId: string;
  /** Posição horizontal em pixels dentro do palco da Suíte */
  x: number;
  /** Posição vertical em pixels dentro do palco da Suíte */
  y: number;
  /** Ordem de sobreposição na sala */
  zIndex: number;
  /** Espelhamento horizontal para ajustar orientação do móvel */
  flipped: boolean;
}

export type SuiteThemeId = 'paris_marfim' | 'milan_sage' | 'noite_veludo';

/** Posição da MeDoll dentro do palco 2D da Suíte */
export interface SuiteAvatarPosition {
  x: number;
  y: number;
  zIndex: number;
  flipped?: boolean;
}

export interface SuiteLayoutState {
  theme: SuiteThemeId;
  /** ID opcional de papel de parede adquirido na Starplaza aplicado à Suíte */
  wallpaperId?: string;
  items: PlacedFurniture[];
  avatarPos?: SuiteAvatarPosition;
  lastSavedAt: string;
}

/** Gênero / Estilo de base do avatar escolhido no cadastro */
export type AvatarGender = 'feminino' | 'masculino' | 'neutro';

/** Status de presença em tempo real selecionável pelo jogador no Meu Perfil */
export type PresenceStatus = 'online' | 'ausente' | 'offline';

/** Definição de País e Fuso Horário configurável na conta */
export interface AccountCountryOption {
  code: string;
  name: string;
  cityLabel: string;
  timezone: string;
  ipPrefix: string;
}

/** Servidores regionais/idioma disponíveis no Starlight Atelier */
export type ServerRegion = 'BR' | 'ES' | 'EN';

/** Papel do usuário para controle de acesso ao painel Mod Tools */
export type UserRole = 'admin' | 'player';

/** Categoria visual e funcional do crachá de cargo na Equipe / Staff */
export type StaffRoleTier =
  | 'admin'
  | 'mod_br'
  | 'mod_es'
  | 'mod_en'
  | 'cm_br'
  | 'cm_es'
  | 'cm_en'
  | 'designer_global';

/** Especialidade autônoma de Inteligência Artificial atribuída a um Bot da Staff */
export type BotAiSpecialty = 'maintenance' | 'moderation' | 'hybrid' | 'designer';

/** Registro persistido no Log de Manutenção e Moderação Autônoma da IA */
export interface AiMaintenanceLogEntry {
  id: string;
  timestamp: number;
  botId: string;
  botName: string;
  botUsername: string;
  serverRegion?: ServerRegion;
  category: 'maintenance' | 'moderation' | 'design';
  issueDetected: string;
  actionTaken: string;
  status: 'repaired' | 'banned' | 'healthy' | 'warning' | 'muted' | 'created';
}

/** Conta de usuário salva no localStorage (Fonte Única de Verdade) */
export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  email: string;
  password: string;
  /** Hash criptográfico scrypt armazenado no banco central do servidor */
  password_hash?: string;
  avatarGender: AvatarGender;
  role: UserRole;
  staffRoleTier?: StaffRoleTier;
  staffRoleTitle?: string;
  /** Servidor de atuação para moderadores e gerentes regionais (BR, ES, EN) */
  serverRegion?: ServerRegion;
  /** Indica se a conta possui assinatura VIP para itens dourados exclusivos */
  isVip?: boolean;
  /** Indica perfil automático/bot gerenciado pelo Administrador */
  isBot?: boolean;
  /** Especialidade de IA autônoma do Bot */
  botAiSpecialty?: BotAiSpecialty;
  /** Define se o módulo de IA do bot está ligado em tempo real */
  botActive?: boolean;
  /** Define se o bot circula livremente pelas salas públicas (true) ou fica fora das salas (false) */
  botRoamRooms?: boolean;
  isPrimaryOwner?: boolean;
  createdAt: string;
  /** Foto de perfil isolada por UID exclusivo no banco de dados */
  profilePic?: string;
}

/** Usuário ou conta registrada exibida no painel de Moderação (Mod Tools) */
export interface MockUser {
  id: string;
  username: string;
  displayName?: string;
  level: number;
  starcoins: number;
  status: 'active' | 'banned';
  banReason?: string;
  joinedAt: string;
  role?: UserRole;
  staffRoleTier?: StaffRoleTier;
  serverRegion?: ServerRegion;
  isVip?: boolean;
  isPrimaryOwner?: boolean;
  simulatedIp?: string;
  countryCode?: string;
}

/** Modo de exibição do ícone oficial de perfil do jogador */
export type AvatarDisplayMode = 'medoll' | 'photo';

/** Estado individual de progresso salvo por conta de usuário */
export interface PlayerProgressState {
  starcoins: number;
  ownedItemIds: string[];
  /** Móveis desbloqueados/comprados pelo jogador para decorar a Suíte */
  ownedFurnitureIds?: string[];
  /** Modelos de Sala (comuns e VIP) comprados na Starplaza para criar salas personalizadas */
  ownedRoomTemplateIds?: string[];
  /** Planos de fundo / papéis de parede comprados na Starplaza */
  ownedWallpaperIds?: string[];
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  /** Imagem customizada enviada do computador (Data URL) */
  customAvatarUrl?: string;
  /** Foto de perfil isolada por UID exclusivo */
  profilePic?: string;
  /** Define se o ícone oficial usa a MeDoll ao vivo ou a foto enviada */
  avatarDisplayMode: AvatarDisplayMode;
  /** Biografia / Recado livre exibido e editado na aba Meu Perfil */
  bio: string;
  /** Status de presença em tempo real (Online / Ausente / Offline) */
  presenceStatus: PresenceStatus;
  /** Código do país de origem da conta */
  countryCode: string;
  /** Fuso horário IANA sincronizado com o relógio local */
  timezone: string;
  /** Endereço IP simulado de conexão para exibição técnica e moderação */
  simulatedIp: string;
  /** Lista de nomes de usuário (normalizados) adicionados como amigos */
  friendUsernames?: string[];
  suite: SuiteLayoutState;
}

/** Mensagem privada entre jogadores salva no localStorage */
export interface PrivateMessage {
  id: string;
  fromUsername: string;
  toUsername: string;
  text: string;
  createdAt: number;
}

/** Dados consolidados para exibir o modal de Perfil Público Visitante de qualquer jogador ou Staff */
export interface PublicProfileSummary {
  accountId?: string;
  username: string;
  displayName: string;
  role: UserRole;
  staffRoleTier?: StaffRoleTier;
  staffRoleTitle?: string;
  serverRegion?: ServerRegion;
  isVip?: boolean;
  level: number;
  starcoins: number;
  presenceStatus: PresenceStatus;
  staffStatus?: StaffStatus;
  bio: string;
  countryCode: string;
  timezone: string;
  simulatedIp: string;
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  customAvatarUrl?: string;
  avatarDisplayMode: AvatarDisplayMode;
  suite: SuiteLayoutState;
}

/** Status em tempo real exibido no card da Equipe de Moderação */
export type StaffStatus = 'online' | 'ausente' | 'em_ronda';

/** Membro oficial da Equipe de Moderação / Staff exibido na aba Moderação */
export interface StaffMember {
  id: string;
  /** ID da conta de usuário vinculada no localStorage para sincronização em tempo real */
  accountId?: string;
  username: string;
  roleTitle: string;
  roleTier: StaffRoleTier;
  status: StaffStatus;
  bio: string;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  equipped: EquippedOutfit;
  isPrimaryOwner?: boolean;
}

/** Identificador de sala global (salas padrão ou criadas por jogadores) */
export type RoomId = string;

/** Fundos arquitetônicos disponíveis para salas padrão e criadas por jogadores */
export type RoomBackdropTheme =
  | 'quarto_cozy'
  | 'lounge_principal'
  | 'cafe_starlight'
  | 'festa_cobertura'
  | 'atelier_rosa'
  | 'boate_neon'
  | 'hotel_royal_vip'
  | 'bar_lounge'
  | 'cobertura_diamante_vip'
  | 'casa_estar_moderna'
  | 'estudio_3d_designer';

/** Item na fila de músicas da Cabine de DJ */
export interface RoomDjQueuedTrack {
  id: string;
  videoId: string;
  youtubeUrl: string;
  title: string;
  addedBy: string;
}

/** Estado sincronizado de música da Cabine de DJ por sala (via YouTube) */
export interface RoomDjTrack {
  videoId: string;
  youtubeUrl: string;
  title: string;
  addedBy: string;
  startedAt: number;
  isPlaying: boolean;
  queue?: RoomDjQueuedTrack[];
}

/** Mobília interativa e obstáculos de colisão em salas 2D */
export interface RoomInteractiveProp {
  id: string;
  kind: 'chair' | 'sofa' | 'table';
  label: string;
  /** Coordenadas percentuais (0..100) no palco da sala */
  x: number;
  y: number;
  /** Ponto de assento em % quando clicável (chair/sofa) */
  seatX?: number;
  seatY?: number;
  /** Raio de colisão em % para mesas/obstáculos sólidos */
  collisionRadius?: number;
  collidable?: boolean;
  primaryColor?: string;
  accentColor?: string;
}

/** Definição de uma Sala Global no Lobby */
export interface RoomDef {
  id: RoomId;
  name: string;
  subtitle: string;
  backdropTheme: RoomBackdropTheme;
  /** UID do proprietário oficial (salas oficiais pertencem ao Admin Geral) */
  ownerId?: string;
  isOfficial?: boolean;
  /** Móveis interativos (cadeiras sentáveis e mesas com colisão) */
  interactiveProps?: RoomInteractiveProp[];
  /** Papel de parede personalizado aplicado à sala */
  wallpaperId?: string;
  /** Limite superior e inferior do piso caminhável em coordenadas percentuais (0..100) */
  walkMinY: number;
  walkMaxY: number;
  visibility: 'public' | 'private';
  serverRegion?: ServerRegion;
  password?: string;
  inviteCode?: string;
  creatorUsername?: string;
  /** Aviso local exibido dentro da sala e editável pelo dono da sala */
  roomNotice?: string;
  isCustom?: boolean;
}

/** Estado sincronizado de um avatar conectado em uma sala */
export interface RoomAvatarPresence {
  clientId: string;
  username: string;
  role: UserRole;
  staffRoleTier?: StaffRoleTier;
  isVip?: boolean;
  roomId: RoomId;
  /** Coordenada horizontal em percentual da largura do palco (8..92) */
  x: number;
  /** Coordenada vertical em percentual da altura do palco (walkMinY..walkMaxY) */
  y: number;
  facing: 'left' | 'right';
  isSeated?: boolean;
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  customAvatarUrl?: string;
  avatarDisplayMode?: AvatarDisplayMode;
  lastSeen: number;
  isBot?: boolean;
  /** Última mensagem enviada para balão de fala sobre a cabeça */
  lastMessage?: string;
  lastMessageAt?: number;
}

/** Snapshot de avatar anexado a uma mensagem para exibir foto oficial no chat */
export interface ChatSenderAvatar {
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  customAvatarUrl?: string;
  avatarDisplayMode?: AvatarDisplayMode;
}

/** Mensagem de chat em tempo real dentro de uma sala */
export interface RoomChatMessage {
  id: string;
  roomId: RoomId;
  senderUsername: string;
  senderRole: UserRole | 'system';
  senderStaffTier?: StaffRoleTier;
  senderIsVip?: boolean;
  text: string;
  createdAt: number;
  senderAvatar?: ChatSenderAvatar;
}

/** Registro de mute temporário (5 min) aplicado pela moderação progressiva */
export interface MutedUserEntry {
  until: number;
  reason: string;
  by: string;
  server: ServerRegion;
}

/** Denúncia enviada via /report nas salas */
export interface RoomReportEntry {
  id: string;
  reporter: string;
  target: string;
  reason: string;
  server: ServerRegion;
  roomId: RoomId;
  createdAt: number;
  handledByBot?: string;
}

export type NewsCategory =
  | 'Lançamentos'
  | 'Coleção VIP'
  | 'Comunidade & Conduta'
  | 'Atualizações';

/** Post editorial da aba Notícias publicado pelos Gerentes da Comunidade ou Staff */
export interface NewsPost {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
  imageCaption?: string;
  category: NewsCategory;
  serverRegion: ServerRegion;
  authorAccountId?: string;
  authorUsername: string;
  authorDisplayName: string;
  authorRoleTier: StaffRoleTier;
  createdAt: number;
  featuredItemIds?: string[];
}

/** Estado compartilhado da sala e moderação (aplicado a todos os perfis) */
export interface WorldModerationState {
  globalNotice: string;
  /** Avisos comunitários e de eventos por servidor regional (geridos pelo Admin ou Gerente da Comunidade) */
  serverNotices?: Partial<Record<ServerRegion, string>>;
  users: MockUser[];
  deletedItemIds: string[];
  /** Peças de vestuário adicionadas pelo Designer Global ou Ateliê de Criação do Admin */
  customClothingCatalog?: ClothingItem[];
  /** Móveis adicionados pelo Designer Global ou Ateliê de Criação do Admin */
  customFurnitureCatalog?: FurnitureDef[];
  /** Modelos de Sala (comuns/VIP) adicionados dinamicamente */
  customRoomCatalog?: PurchasableRoomItem[];
  /** Papéis de parede / planos de fundo adicionados dinamicamente */
  customWallpaperCatalog?: PurchasableWallpaperItem[];
  /** Postagens editoriais e anúncios com fotos exibidos na aba Notícias */
  newsPosts?: NewsPost[];
  /** Registro de relógio real para ciclo autônomo de 2 horas do Designer Global */
  lastDesignerCreationAt?: number;
  /** Registro de relógio real para lançamentos semanais VIP (7 dias) */
  lastWeeklyVipReleaseAt?: number;
  /** Registro da última auditoria de roupas executada pelo Designer Global */
  lastDesignerAuditAt?: number;
  /** Usuários com mute temporário indexados por username normalizado */
  mutedUsers?: Record<string, MutedUserEntry>;
  /** Contagem de advertências progressivas indexada por username normalizado */
  warningCounts?: Record<string, number>;
  /** Registro de denúncias feitas pelos jogadores via /report */
  reports?: RoomReportEntry[];
  /** Campo legado mantido apenas opcional para compatibilidade na leitura inicial; a Staff é filtrada dinamicamente das contas */
  staffMembers?: StaffMember[];
  bannedWords: string[];
}

/** Estado global legado/unificado usado em memória pelo App */
export interface PersistedGameState extends PlayerProgressState, WorldModerationState {}

/** Mensagem dentro de um chamado de suporte (IA ou Moderador humano) */
export interface SupportChatMessage {
  id: string;
  senderRole: 'player' | 'ai_bot' | 'moderator';
  sender?: 'user' | 'ai' | 'moderator';
  senderName: string;
  text: string;
  createdAt: number;
}

/** Chamado de suporte aberto no botão Help ou na aba Moderação */
export interface SupportTicket {
  id: string;
  requesterAccountId?: string;
  requesterUsername: string;
  requesterId?: string;
  email?: string;
  category?: 'login' | 'ban_review' | 'economia' | 'bug' | 'geral';
  serverRegion?: ServerRegion;
  subject: string;
  messages: SupportChatMessage[];
  status: 'ai_handling' | 'queued_human' | 'resolved';
  assignedModeratorUsername?: string;
  createdAt: number;
  updatedAt: number;
}

/** Solicitação / Revisão de banimento na fila do Moderador */
export interface BanReviewRequest {
  id: string;
  targetAccountId?: string;
  targetUserId?: string;
  targetUsername: string;
  reason: string;
  appealMessage?: string;
  moderatorNote?: string;
  serverRegion?: ServerRegion;
  status: 'pending' | 'approved_unban' | 'upheld';
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt?: number;
}

/** Métrica em tempo real da saúde de uma sala multiplayer */
export interface RoomHealthMetric {
  roomId: RoomId;
  roomName: string;
  serverRegion?: ServerRegion;
  status: 'Estável' | 'Crítica';
  latencyMs: number;
  packetDrops?: number;
  packetDropRate?: number;
  wsErrorsPerMin: number;
  activePlayers?: number;
  activeClients?: number;
  simulatedSpike?: boolean;
  lastCheckedAt: number;
  lastTerminatedAt?: number;
  terminatedAt?: number;
}

/** Identificadores das 4 Mesas de Trabalho interativas nas salas da Staff */
export type StaffWorkDeskType =
  | 'admin_desk'
  | 'cm_control_desk'
  | 'moderator_desk'
  | 'designer_workbench';

