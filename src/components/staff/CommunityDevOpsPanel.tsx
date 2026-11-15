import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  Megaphone,
  PowerOff,
  RefreshCw,
  Server,
  Wrench,
} from 'lucide-react';
import type {
  AiMaintenanceLogEntry,
  RoomHealthMetric,
  ServerRegion,
  UserAccount,
} from '../../types/game';
import { useGlobalState } from '../../core/state/GlobalStateManager';
import { resolveCoreStaffRole } from '../../core/security/RoleGuard';
import type { AutonomousLifeTickResult, MaintenanceScanResult } from '../../utils/aiBots';
import { SERVER_REGION_META } from '../../utils/storage';

interface CommunityDevOpsPanelProps {
  currentUser: UserAccount;
  serverNotices?: Partial<Record<ServerRegion, string>>;
  aiLogs: AiMaintenanceLogEntry[];
  onUpdateServerNotice?: (server: ServerRegion, notice: string) => void;
  onRunAiDiagnostics: () => MaintenanceScanResult;
  onSimulateFaultAndRepair: () => MaintenanceScanResult;
  onRunBotLifeTick?: () => AutonomousLifeTickResult;
}

export const CommunityDevOpsPanel: React.FC<CommunityDevOpsPanelProps> = ({
  currentUser,
  serverNotices,
  aiLogs,
  onUpdateServerNotice,
  onRunAiDiagnostics,
  onSimulateFaultAndRepair,
  onRunBotLifeTick,
}) => {
  const { roomHealthList, refreshRoomHealth } = useGlobalState();
  const [busyAction, setBusyAction] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [killReason, setKillReason] = useState('Dessincronização de instâncias / pico WebSocket');
  const [noticeServer, setNoticeServer] = useState<ServerRegion>('BR');
  const [noticeText, setNoticeText] = useState(serverNotices?.BR ?? '');

  useEffect(() => {
    void refreshRoomHealth();
  }, [refreshRoomHealth]);

  const role = resolveCoreStaffRole(currentUser) || 'cm';
  const staffHeaders = {
    'Content-Type': 'application/json',
    'x-actor-id': currentUser.id,
    'x-staff-role': role,
    'x-actor-email': currentUser.email,
  };

  const handleToggleSpike = async (metric: RoomHealthMetric) => {
    setBusyAction(true);
    try {
      const res = await fetch('/api/rooms/simulate-spike', {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({
          roomId: metric.roomId,
          active: !metric.simulatedSpike,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setFeedback(data.error || 'Falha ao simular pico.');
      } else {
        setFeedback(
          !metric.simulatedSpike
            ? `Pico crítico simulado em "${metric.roomName}" — pronta para teste de Kill-Switch ou Auto Patch.`
            : `Pico removido de "${metric.roomName}".`,
        );
        await refreshRoomHealth();
      }
    } catch {
      setFeedback('Erro de conexão ao atualizar telemetria.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleKillSwitch = async (metric: RoomHealthMetric) => {
    if (metric.roomId === 'lounge_principal') return;
    setBusyAction(true);
    try {
      const res = await fetch('/api/rooms/terminate', {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({
          roomId: metric.roomId,
          reason: killReason.trim() || 'Instabilidade crítica detectada no monitoramento',
          actorUsername: currentUser.displayName || currentUser.username,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        evacuatedCount?: number;
        error?: string;
      };
      if (!data.ok) {
        setFeedback(data.error || 'RoleGuard negou encerramento.');
      } else {
        setFeedback(
          `Kill-Switch executado em "${metric.roomName}": ${data.evacuatedCount ?? 0} jogador(es) evacuado(s) com segurança para o Lounge Principal e Auto Patch Note publicado!`,
        );
        await refreshRoomHealth();
      }
    } catch {
      setFeedback('Falha de rede ao acionar Kill-Switch.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleAutoPatchScan = async () => {
    setBusyAction(true);
    try {
      const localScan = onRunAiDiagnostics();
      const res = await fetch('/api/rooms/auto-patch', {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({
          actorUsername: currentUser.displayName || currentUser.username,
          serverRegion: currentUser.serverRegion || 'BR',
          anomalySummary: `Varredura completa: ${localScan.repairedCount} item(ns) reparado(s) no cliente + normalização de salas.`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        repairedCount?: number;
        error?: string;
      };
      if (data.ok) {
        setFeedback(
          `Auto Patch Notes publicado em Notícias! ${data.repairedCount ?? 0} sala(s) crítica(s) estabilizada(s) e ${localScan.repairedCount} reparo(s) locais concluídos.`,
        );
        await refreshRoomHealth();
      } else {
        setFeedback(data.error || 'Erro ao gerar Auto Patch Note.');
      }
    } catch {
      setFeedback('Erro de conexão com /api/rooms/auto-patch.');
    } finally {
      setBusyAction(false);
    }
  };

  const criticalCount = roomHealthList.filter((m) => m.status === 'Crítica').length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho Sala de Controle */}
      <div className="bg-[#0F172A] text-white rounded-xl p-5 border border-[#38BDF8]/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0284C7]/30 border border-[#38BDF8]/60 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5 text-[#38BDF8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold text-white">
                Sala de Controle · Community Manager & Engenheiro DevOps
              </h3>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                  criticalCount > 0
                    ? 'bg-rose-500 text-white'
                    : 'bg-emerald-500 text-[#06281E]'
                }`}
              >
                {criticalCount > 0
                  ? `${criticalCount} Sala(s) Crítica(s)`
                  : 'Telemetria Estável'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Monitoramento de latência WebSocket, Kill-Switch com evacuação segura, Auto Patch Notes e eventos regionais.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busyAction}
            onClick={() => void refreshRoomHealth()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar Telemetria
          </button>
          <button
            type="button"
            disabled={busyAction}
            onClick={() => void handleAutoPatchScan()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5" />
            Reparar & Auto Patch Note
          </button>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-xs font-medium text-[#0C4A6E] flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-bold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Monitor de Saúde das Salas + Kill Switch */}
      <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0284C7]" />
              Saúde das Salas em Tempo Real (WebSocket Telemetry)
            </h4>
            <p className="text-xs text-[#6B645D]">
              Instâncias críticas podem ser encerradas com segurança via Kill-Switch sem perder itens ou desconectar contas.
            </p>
          </div>
          <input
            type="text"
            value={killReason}
            onChange={(e) => setKillReason(e.target.value)}
            placeholder="Motivo padrão do Kill-Switch..."
            className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg w-full sm:w-72"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {roomHealthList.map((metric) => {
            const isCrit = metric.status === 'Crítica';
            const isSafeLounge = metric.roomId === 'lounge_principal';
            return (
              <div
                key={metric.roomId}
                className={`p-3.5 rounded-xl border transition-colors ${
                  isCrit
                    ? 'bg-rose-50/70 border-rose-300'
                    : 'bg-[#FAF8F5] border-[#E6E0D8]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isCrit ? (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <h5 className="text-xs font-bold text-[#1C1917] truncate">
                        {metric.roomName}
                      </h5>
                    </div>
                    <p className="text-[11px] font-mono text-[#6B645D] mt-0.5">
                      ID: {metric.roomId} · Jogadores: {metric.activePlayers ?? metric.activeClients ?? 0}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      isCrit
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {metric.status}
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px] font-mono bg-white/80 p-2 rounded-lg border border-[#EFEAE3]">
                  <div>
                    <span className="text-[#78716C] block text-[10px]">Latência</span>
                    <strong className={metric.latencyMs >= 300 ? 'text-rose-600' : 'text-[#1C1917]'}>
                      {metric.latencyMs} ms
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px]">Packet Drops</span>
                    <strong className={(metric.packetDrops ?? metric.packetDropRate ?? 0) > 5 ? 'text-rose-600' : 'text-[#1C1917]'}>
                      {metric.packetDrops ?? metric.packetDropRate ?? 0}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px]">Erros WS/min</span>
                    <strong className={metric.wsErrorsPerMin > 3 ? 'text-rose-600' : 'text-[#1C1917]'}>
                      {metric.wsErrorsPerMin}
                    </strong>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleToggleSpike(metric)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#E6E0D8] hover:border-amber-400 text-[#44403C] rounded-lg cursor-pointer"
                  >
                    <Flame className="w-3 h-3 text-amber-500" />
                    {metric.simulatedSpike ? 'Limpar Pico' : 'Simular Pico'}
                  </button>
                  {!isSafeLounge && (
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => void handleKillSwitch(metric)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                    >
                      <PowerOff className="w-3 h-3" />
                      Kill-Switch (Evacuar)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Eventos Regionais & Ferramentas DevOps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
          <h4 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#0284C7]" />
            Comunicado de Eventos por Servidor Regional
          </h4>
          <div className="flex gap-2">
            {(['BR', 'ES', 'EN'] as ServerRegion[]).map((srv) => (
              <button
                key={srv}
                type="button"
                onClick={() => {
                  setNoticeServer(srv);
                  setNoticeText(serverNotices?.[srv] ?? '');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                  noticeServer === srv
                    ? 'bg-[#0284C7] text-white border-[#0284C7]'
                    : 'bg-[#FAF8F5] text-[#57534E] border-[#E6E0D8]'
                }`}
              >
                {SERVER_REGION_META[srv].flagEmoji} {srv}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              placeholder={`Aviso oficial para o servidor ${noticeServer}...`}
              className="flex-1 px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg"
            />
            <button
              type="button"
              onClick={() => {
                onUpdateServerNotice?.(noticeServer, noticeText.trim());
                setFeedback(`Aviso regional do servidor ${noticeServer} atualizado.`);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#332E2B] rounded-lg cursor-pointer"
            >
              Salvar
            </button>
          </div>
          <div className="pt-2 border-t border-[#EFEAE3] flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const res = onSimulateFaultAndRepair();
                setFeedback(
                  `Teste de falha & auto-reparo concluído: ${res.repairedCount} reparo(s) registrado(s).`,
                );
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#FAF8F5] border border-[#E6E0D8] hover:border-[#0284C7] rounded-lg cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 text-[#0284C7]" />
              Simular Falha & Auto-Reparo Local
            </button>
            {onRunBotLifeTick && (
              <button
                type="button"
                onClick={() => {
                  onRunBotLifeTick();
                  setFeedback('Ciclo de patrulha técnica dos Bots atualizado.');
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-[#FAF8F5] border border-[#E6E0D8] rounded-lg cursor-pointer"
              >
                Atualizar Patrulha Bots
              </button>
            )}
          </div>
        </section>

        <section className="bg-white border border-[#E6E0D8] rounded-xl p-5 space-y-3">
          <h4 className="font-display text-base font-bold text-[#1C1917]">
            Logs Recentes da Engenharia & Bots ({aiLogs.length})
          </h4>
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {aiLogs.length === 0 ? (
              <p className="text-xs text-[#6B645D]">Nenhuma ação registrada recentemente.</p>
            ) : (
              aiLogs.slice(0, 25).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#EFEAE3] text-[11px]"
                >
                  <div className="flex items-center justify-between font-semibold text-[#1C1917]">
                    <span>{log.botName}</span>
                    <span className="text-[10px] text-[#78716C]">
                      {new Date(log.timestamp || Date.now()).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-[#57534E] mt-0.5">
                    {log.actionTaken || log.issueDetected}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
