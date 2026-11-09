import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { SnapState } from '@/lib/aios/orbitGraph';

function rel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 0) return 'agora';
  if (s < 60) return Math.floor(s) + 's';
  if (s < 3600) return Math.floor(s / 60) + 'min';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

type Tab = 'dashboard' | 'auditoria' | 'semanal';

export default function AgenteComercialDashboard({ state }: { state: SnapState | null }) {
  const [tab, setTab] = useState<Tab>('dashboard');

  const ac = state?.agente_comercial;
  if (!ac) return null;

  const convs = ac.conversas_respondidas ?? 0;
  const fups = ac.followups_pendentes ?? 0;
  const reports = ac.relatorios_total ?? 0;
  const semanal = ac.resumo_semanal;

  const lastRun = ac.ultima_execucao;
  const lastStatus = ac.ultimo_status;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard Performance', icon: '📊' },
    { id: 'auditoria', label: 'Auditoria Diária', icon: '📋' },
    { id: 'semanal', label: 'Auditoria Semanal', icon: '📈' },
  ];

  return (
    <section className="rounded-xl border border-[#141821] bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-500">
          🤖 Agente Comercial
        </h2>
        {lastRun && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                lastStatus === 'ok' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-400 shadow-[0_0_6px_#fb7185]'
              )}
            />
            Última execução: {rel(lastRun)} · {lastStatus === 'ok' ? 'OK' : 'ERROR'}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors',
              tab === t.id
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-400'
                : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Dashboard */}
      {tab === 'dashboard' && (
        <div>
          <div className="mb-4 flex flex-wrap gap-3">
            <KpiCard value={convs} label="💬 Conversas respondidas" color="ok" />
            <KpiCard value={fups} label="📅 Follow-ups pendentes" color={fups > 0 ? 'warn' : 'ok'} />
            <KpiCard value={reports} label="📋 Relatórios gerados" color="ok" />
            {semanal && (
              <>
                <KpiCard value={semanal.leads_contactadas ?? '-'} label="👥 Leads na semana" color="ok" />
                <KpiCard value={semanal.convertidas ?? '-'} label="✅ Convertidas" color={semanal.convertidas > 0 ? 'ok' : 'muted'} />
                <KpiCard value={semanal.ocorrencias ?? '-'} label="⚠️ Ocorrências" color={(semanal.ocorrencias ?? 0) > 0 ? 'warn' : 'ok'} />
              </>
            )}
          </div>

          {/* Follow-ups */}
          {ac.followups && ac.followups.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-medium text-muted-foreground">Próximos follow-ups:</div>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Lead</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Canal</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ac.followups.map((f: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-2 text-foreground">{f.lead}</td>
                        <td className="px-3 py-2 text-muted-foreground">{f.channel}</td>
                        <td className="px-3 py-2 text-muted-foreground">{f.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Auditoria Diária */}
      {tab === 'auditoria' && (
        <div>
          {ac.ultimo_relatorio ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <span className="text-[12px] text-muted-foreground">
                📄 Último relatório: <span className="font-mono text-foreground">{ac.ultimo_relatorio}</span>
              </span>
              <a
                href={`https://vianta-dashboard.netlify.app/aios-live/relatorios/${ac.ultimo_relatorio}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-medium text-cyan-400 hover:bg-cyan-500/20"
              >
                📂 Abrir
              </a>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">Nenhum relatório disponível.</div>
          )}
        </div>
      )}

      {/* Tab: Auditoria Semanal */}
      {tab === 'semanal' && (
        <div>
          {semanal ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-[12px] leading-relaxed text-foreground">
                <p>
                  Esta semana, o agente falou com <strong className="text-cyan-400">{semanal.leads_contactadas ?? '—'}</strong> pessoas,
                  {' '}converteu <strong className={semanal.convertidas > 0 ? 'text-emerald-400' : 'text-muted-foreground'}>{semanal.convertidas ?? 0}</strong>,
                  {' '}teve <strong className={(semanal.ocorrencias ?? 0) > 0 ? 'text-amber-400' : 'text-muted-foreground'}>{semanal.ocorrencias ?? 0}</strong> ocorrências,
                  {' '}<strong className="text-amber-400">{semanal.pendentes ?? 0}</strong> pendentes
                  {' '}e <strong className="text-cyan-400">{semanal.sugestoes ?? 0}</strong> sugestões de melhoria identificadas.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <MiniCard label="Leads" value={semanal.leads_contactadas ?? 0} />
                <MiniCard label="Convertidas" value={semanal.convertidas ?? 0} muted />
                <MiniCard label="Ocorrências" value={semanal.ocorrencias ?? 0} warn={(semanal.ocorrencias ?? 0) > 0} />
                <MiniCard label="Pendentes" value={semanal.pendentes ?? 0} warn />
                <MiniCard label="Sugestões" value={semanal.sugestoes ?? 0} />
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">Sem dados semanais disponíveis.</div>
          )}
        </div>
      )}
    </section>
  );
}

/* ─── Helpers ─── */

function KpiCard({ value, label, color }: { value: number | string; label: string; color: 'ok' | 'warn' | 'muted' }) {
  const colorMap = { ok: 'text-emerald-400', warn: 'text-amber-400', muted: 'text-muted-foreground' };
  return (
    <div className="flex min-w-[100px] flex-1 flex-col rounded-lg border border-border bg-muted/20 p-3">
      <span className={cn('text-xl font-bold', colorMap[color])}>{value}</span>
      <span className="mt-0.5 text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function MiniCard({ label, value, muted, warn }: { label: string; value: number; muted?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-2.5 text-center">
      <div className={cn('text-base font-bold', muted ? 'text-muted-foreground' : warn ? 'text-amber-400' : 'text-cyan-400')}>
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}
