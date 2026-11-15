import React, { useMemo, useState } from 'react';
import { Calendar, Camera, Globe, Newspaper, Plus, Sparkles, X } from 'lucide-react';
import { NEWS_PHOTO_ASSETS } from '../data/catalog';
import { NewsCategory, NewsPost, ServerRegion, UserAccount } from '../types/game';
import {
  getCommunityManagerServer,
  isDesignerGlobalAccount,
  isPrimaryAdminAccount,
  normalizeUsername,
} from '../utils/storage';
import { StaffRoleBadge } from './StaffDirectory';

interface NewsFeedViewProps {
  posts: NewsPost[];
  currentUser: UserAccount;
  onPublishPost: (input: Omit<NewsPost, 'id' | 'createdAt'>) => void;
  onOpenPublicProfile: (username: string) => void;
  onGoToShop?: () => void;
  onGoToVipStore?: () => void;
}

const NEWS_CATEGORIES: Array<'todas' | NewsCategory> = [
  'todas',
  'Lançamentos',
  'Coleção VIP',
  'Comunidade & Conduta',
  'Atualizações',
];

const SERVER_FILTER_LABELS: Record<'todos' | ServerRegion, string> = {
  todos: 'Todos os Idiomas',
  BR: 'Português (BR)',
  ES: 'Español (ES)',
  EN: 'English (EN)',
};

export const NewsFeedView: React.FC<NewsFeedViewProps> = ({
  posts,
  currentUser,
  onPublishPost,
  onOpenPublicProfile,
  onGoToShop,
  onGoToVipStore,
}) => {
  const [serverFilter, setServerFilter] = useState<'todos' | ServerRegion>('todos');
  const [categoryFilter, setCategoryFilter] = useState<'todas' | NewsCategory>('todas');
  const [composerOpen, setComposerOpen] = useState(false);

  const cmServer = getCommunityManagerServer(currentUser);
  const isOwner = isPrimaryAdminAccount(currentUser);
  const isDesigner = isDesignerGlobalAccount(currentUser);
  const canPublish = isOwner || Boolean(cmServer) || isDesigner;

  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftCategory, setDraftCategory] = useState<NewsCategory>('Lançamentos');
  const [draftServer, setDraftServer] = useState<ServerRegion>(
    cmServer ?? currentUser.serverRegion ?? 'BR',
  );
  const [draftPhotoIdx, setDraftPhotoIdx] = useState(0);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);

  const filteredPosts = useMemo(() => {
    return [...posts]
      .filter((post) => {
        if (serverFilter !== 'todos' && post.serverRegion !== serverFilter) return false;
        if (categoryFilter !== 'todas' && post.category !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [posts, serverFilter, categoryFilter]);

  const handleSubmitPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish || !draftTitle.trim() || !draftBody.trim()) return;
    const chosenAsset = NEWS_PHOTO_ASSETS[draftPhotoIdx] ?? NEWS_PHOTO_ASSETS[0];
    onPublishPost({
      title: draftTitle.trim(),
      summary:
        draftSummary.trim() ||
        draftBody.trim().slice(0, 140) + (draftBody.trim().length > 140 ? '…' : ''),
      body: draftBody.trim(),
      imageUrl: chosenAsset.url,
      imageCaption: chosenAsset.label,
      category: draftCategory,
      serverRegion: cmServer ?? draftServer,
      authorAccountId: currentUser.id,
      authorUsername: normalizeUsername(currentUser.username),
      authorDisplayName: currentUser.displayName,
      authorRoleTier: currentUser.staffRoleTier ?? 'cm_br',
    });
    setDraftTitle('');
    setDraftSummary('');
    setDraftBody('');
    setComposerOpen(false);
    setPublishNotice('Publicação editorial adicionada ao Jornal Starlight!');
    window.setTimeout(() => setPublishNotice(null), 4000);
  };

  const leadPost = filteredPosts[0];
  const secondaryPosts = filteredPosts.slice(1);

  const formatPostDate = (ts: number) =>
    new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      {/* Cabeçalho Editorial da Revista / Notícias */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#FDF2F5] border border-[#F3D0DC] text-[#C8235D] flex items-center justify-center shrink-0">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold text-[#1C1917] tracking-tight">
              Starlight Magazine & Notícias
            </h2>
            <p className="text-sm text-[#57534E] mt-0.5 max-w-2xl">
              Cobertura fotográfica dos lançamentos da Starplaza, edições Lendárias VIP, eventos da comunidade e boletins dos Gerentes da Comunidade (BR · ES · EN).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onGoToVipStore && (
            <button
              type="button"
              onClick={onGoToVipStore}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#78350F] bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#D97706] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              VIP & StarCoins
            </button>
          )}
          {onGoToShop && (
            <button
              type="button"
              onClick={onGoToShop}
              className="px-3.5 py-2 text-xs font-semibold text-[#1C1917] bg-[#F5F2EC] hover:bg-[#EAE4DA] border border-[#DFD8CE] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Visitar Starplaza
            </button>
          )}
          {canPublish && (
            <button
              type="button"
              onClick={() => setComposerOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8235D] hover:bg-[#A61B4B] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Publicar Matéria
            </button>
          )}
        </div>
      </section>

      {publishNotice && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-[#FDF2F5] border border-[#F3D0DC] text-xs font-medium text-[#9E1646]"
        >
          {publishNotice}
        </div>
      )}

      {/* Formulário Editorial para Staff autorizada */}
      {canPublish && composerOpen && (
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE3]">
            <h3 className="text-base font-semibold text-[#1C1917] flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#C8235D]" />
              Nova Publicação Fotográfica da Equipe
            </h3>
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              aria-label="Fechar editor"
              className="p-1 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitPost} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold text-[#44403C]">
                  Manchete da Notícia
                </span>
                <input
                  type="text"
                  required
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Ex: Novo Drop Y2K e Encontro na Cobertura!"
                  className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">Categoria</span>
                  <select
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value as NewsCategory)}
                    className="mt-1 w-full px-2.5 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
                  >
                    <option value="Lançamentos">Lançamentos</option>
                    <option value="Coleção VIP">Coleção VIP</option>
                    <option value="Comunidade & Conduta">Comunidade & Conduta</option>
                    <option value="Atualizações">Atualizações</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-[#44403C]">Servidor</span>
                  <select
                    disabled={Boolean(cmServer)}
                    value={cmServer ?? draftServer}
                    onChange={(e) => setDraftServer(e.target.value as ServerRegion)}
                    className="mt-1 w-full px-2.5 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D] disabled:opacity-60"
                  >
                    <option value="BR">BR (PT)</option>
                    <option value="ES">ES (ES)</option>
                    <option value="EN">EN (EN)</option>
                  </select>
                </label>
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">
                Linha fina / Resumo curto
              </span>
              <input
                type="text"
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                placeholder="Resumo exibido abaixo da foto..."
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#44403C]">
                Texto completo da matéria
              </span>
              <textarea
                rows={3}
                required
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="Escreva a novidade e orientações para a comunidade..."
                className="mt-1 w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg focus:outline-none focus:border-[#C8235D]"
              />
            </label>

            <div>
              <span className="block text-xs font-semibold text-[#44403C] mb-2">
                Foto Editorial da Capa
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {NEWS_PHOTO_ASSETS.map((asset, idx) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setDraftPhotoIdx(idx)}
                    className={`rounded-lg overflow-hidden border-2 text-left transition-all cursor-pointer ${
                      draftPhotoIdx === idx
                        ? 'border-[#C8235D] ring-2 ring-[#C8235D]/20'
                        : 'border-[#E6E0D8] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={asset.url}
                      alt={asset.label}
                      className="w-full h-20 object-cover"
                    />
                    <p className="p-1.5 text-[10px] font-medium text-[#1C1917] line-clamp-1 bg-[#FAF8F5]">
                      {asset.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#57534E] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg cursor-pointer"
              >
                Publicar no Jornal
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Barra de Filtros por Idioma / Servidor e Categoria */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['todos', 'BR', 'ES', 'EN'] as const).map((srv) => (
            <button
              key={srv}
              type="button"
              onClick={() => setServerFilter(srv)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                serverFilter === srv
                  ? 'bg-[#C8235D] text-white'
                  : 'bg-[#FAF8F5] border border-[#E6E0D8] text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {SERVER_FILTER_LABELS[srv]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {NEWS_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#1C1917] text-white'
                  : 'bg-[#F5F2EC] text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              {cat === 'todas' ? 'Todas as Editorias' : cat}
            </button>
          ))}
        </div>
      </section>

      {filteredPosts.length === 0 ? (
        <div className="bg-white border border-[#E6E0D8] rounded-xl p-12 text-center text-sm text-[#57534E]">
          Nenhuma matéria publicada neste filtro ainda.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Matéria Principal em Destaque */}
          {leadPost && (
            <article className="bg-white border border-[#E6E0D8] rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
              <div className="lg:col-span-7 relative bg-[#F5F2EC]">
                <img
                  src={leadPost.imageUrl}
                  alt={leadPost.title}
                  className="w-full h-72 lg:h-full max-h-[400px] object-cover"
                />
                {leadPost.imageCaption && (
                  <p className="absolute bottom-3 left-3 px-2.5 py-1 rounded bg-[#1C1917]/80 text-white text-[11px] font-medium">
                    {leadPost.imageCaption}
                  </p>
                )}
              </div>

              <div className="lg:col-span-5 p-6 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                    <span className="px-2 py-0.5 rounded bg-[#FDF2F5] text-[#9E1646] border border-[#F4C4D5]">
                      {leadPost.category}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#F5F2EC] text-[#44403C] font-mono-num">
                      Servidor {leadPost.serverRegion}
                    </span>
                  </div>

                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1917] mt-3 leading-snug">
                    {leadPost.title}
                  </h3>
                  <p className="text-sm font-medium text-[#44403C] mt-2 leading-relaxed">
                    {leadPost.summary}
                  </p>
                  <p className="text-xs text-[#57534E] mt-3 leading-relaxed">
                    {leadPost.body}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#EFEAE3] flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenPublicProfile(leadPost.authorUsername)}
                    className="inline-flex flex-wrap items-center gap-2 text-left hover:underline cursor-pointer"
                  >
                    <span className="text-xs font-bold text-[#1C1917]">
                      {leadPost.authorDisplayName}
                    </span>
                    <StaffRoleBadge tier={leadPost.authorRoleTier} compact />
                  </button>

                  <span className="inline-flex items-center gap-1 text-[11px] font-mono-num text-[#78716C]">
                    <Calendar className="w-3 h-3" />
                    {formatPostDate(leadPost.createdAt)}
                  </span>
                </div>
              </div>
            </article>
          )}

          {/* Demais Matérias Fotográficas */}
          {secondaryPosts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {secondaryPosts.map((post) => (
                <article
                  key={post.id}
                  className="bg-white border border-[#E6E0D8] rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-48 bg-[#F5F2EC]">
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-[#1C1917]/85 text-white text-[10px] font-semibold font-mono-num">
                        Servidor {post.serverRegion}
                      </span>
                    </div>

                    <div className="p-5">
                      <span className="text-[11px] font-semibold text-[#C8235D]">
                        {post.category}
                      </span>
                      <h4 className="font-display text-xl font-bold text-[#1C1917] mt-1 leading-snug">
                        {post.title}
                      </h4>
                      <p className="text-xs font-medium text-[#44403C] mt-2 leading-relaxed">
                        {post.summary}
                      </p>
                      <p className="text-xs text-[#6B645D] mt-2 leading-relaxed line-clamp-4">
                        {post.body}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 py-3.5 border-t border-[#EFEAE3] bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenPublicProfile(post.authorUsername)}
                      className="inline-flex flex-wrap items-center gap-1.5 text-left hover:underline cursor-pointer"
                    >
                      <span className="text-xs font-bold text-[#1C1917]">
                        {post.authorDisplayName}
                      </span>
                      <StaffRoleBadge tier={post.authorRoleTier} compact />
                    </button>

                    <span className="text-[11px] font-mono-num text-[#78716C]">
                      {formatPostDate(post.createdAt)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
