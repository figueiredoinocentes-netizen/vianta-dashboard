import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ErrorBox } from '@/components/operacoes/shared';
import { useFinanceiro } from '@/hooks/useOperacoes';
import { CENTROS_CUSTO, mesDe, nomeMes } from '@/lib/financeiro';
import { eur, toNum } from '@/lib/operacoes/custos';
import type { Movimento } from '@/lib/operacoes/types';
import { AlertTriangle, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

const cancelled = (m: Movimento) => (m.descricao || '').startsWith('[ANULADA]');
const isSaft = (m: Movimento) => (m.n_documento || '').startsWith('SAFT ');
const isSaftRevenue = (m: Movimento) => isSaft(m) && !cancelled(m) && toNum(m.valor) > 0;
const isCost = (m: Movimento) => !isSaft(m) && (toNum(m.valor) < 0 || (toNum(m.valor) === 0 && (m.tipo === 'Custo' || m.tipo === 'Despesa')));
const periodDate = (m: Movimento) => (m.data || '').slice(0, 10);
const monthLabel = (ym: string) => nomeMes(ym).replace(/ de /, ' ').replace(/^./, (c) => c.toUpperCase());

type MonthRow = { month: string; receita: number; custos: number; resultado: number };
type CentreRow = { centro: string; receita: number; custos: number; resultado: number };

export default function FinanceiroPL() {
  const { data: movements = [], isLoading, isError } = useFinanceiro();
  const years = useMemo(() => [...new Set(movements.map((m) => periodDate(m).slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))].sort().reverse(), [movements]);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const activeYear = year || years[0] || String(new Date().getFullYear());

  const inPeriod = (m: Movimento) => {
    const d = periodDate(m);
    return d.startsWith(activeYear) && (!month || d.slice(0, 7) === month);
  };
  const periodMovements = useMemo(() => movements.filter(inPeriod), [movements, activeYear, month]);
  const revenueRows = periodMovements.filter(isSaftRevenue);
  const cancelledRows = periodMovements.filter((m) => isSaft(m) && cancelled(m));
  const costRows = periodMovements.filter(isCost);
  const uncategorizedPositive = periodMovements.filter((m) => !isSaft(m) && !isCost(m) && toNum(m.valor) > 0);

  const receita = revenueRows.reduce((s, m) => s + toNum(m.valor_sem_iva ?? m.valor), 0);
  const custos = costRows.reduce((s, m) => s + Math.abs(toNum(m.valor_sem_iva ?? m.valor)), 0);
  const resultado = receita - custos;
  const margem = receita ? (resultado / receita) * 100 : 0;

  const monthly = useMemo(() => {
    const map = new Map<string, MonthRow>();
    const touch = (key: string) => {
      if (!map.has(key)) map.set(key, { month: key, receita: 0, custos: 0, resultado: 0 });
      return map.get(key)!;
    };
    for (const m of periodMovements) {
      const key = mesDe(m.data);
      if (!key) continue;
      if (isSaftRevenue(m)) touch(key).receita += toNum(m.valor_sem_iva ?? m.valor);
      if (isCost(m)) touch(key).custos += Math.abs(toNum(m.valor_sem_iva ?? m.valor));
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({ ...r, resultado: r.receita - r.custos, label: monthLabel(r.month) }));
  }, [periodMovements]);

  const centres = useMemo(() => {
    const map = new Map<string, CentreRow>();
    const touch = (key: string) => {
      const centre = key || 'Geral';
      if (!map.has(centre)) map.set(centre, { centro: centre, receita: 0, custos: 0, resultado: 0 });
      return map.get(centre)!;
    };
    for (const m of periodMovements) {
      if (isSaftRevenue(m)) touch(m.centro_custo || 'Geral').receita += toNum(m.valor_sem_iva ?? m.valor);
      if (isCost(m)) touch(m.centro_custo || 'Geral').custos += Math.abs(toNum(m.valor_sem_iva ?? m.valor));
    }
    return [...new Set([...CENTROS_CUSTO, ...map.keys()])].map((c) => {
      const r = map.get(c) || { centro: c, receita: 0, custos: 0, resultado: 0 };
      return { ...r, resultado: r.receita - r.custos };
    });
  }, [periodMovements]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of revenueRows) {
      const category = m.categoria || 'Por classificar';
      map.set(category, (map.get(category) || 0) + toNum(m.valor_sem_iva ?? m.valor));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [revenueRows]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => `${activeYear}-${String(i + 1).padStart(2, '0')}`)
    .filter((ym) => movements.some((m) => mesDe(m.data) === ym));

  if (isError) return <DashboardLayout><ErrorBox text="Erro ao carregar os movimentos financeiros." /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Financeiro / Relatórios</p>
            <h1 className="font-display text-2xl font-bold text-foreground">P&L</h1>
            <p className="text-sm text-muted-foreground">Receitas e custos registados por período e centro de custo</p>
          </div>
          <div className="flex gap-2">
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Ano" value={activeYear} onChange={(e) => { setYear(e.target.value); setMonth(''); }}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Mês" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Ano completo</option>
              {monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><b>Leitura provisória:</b> as faturas SAF-T importadas continuam com tipo “Custo” na base. Aqui são identificadas pelo nº de documento SAF-T, valor positivo e marca [ANULADA]. Valores apresentados sem IVA; custos considerados apenas quando têm valor registado. Confirma a classificação antes de usar como fecho contabilístico.</p>
        </div>

        {isLoading ? <div className="h-24 animate-pulse rounded-xl bg-muted" /> : <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Receitas (ativas, s/ IVA)" value={eur(receita)} note={`${revenueRows.length} documentos SAF-T`} icon={<TrendingUp className="h-4 w-4" />} tone="text-emerald-600" />
            <Kpi label="Custos registados (s/ IVA)" value={eur(custos)} note={`${costRows.length} movimentos com valor`} icon={<TrendingDown className="h-4 w-4" />} tone="text-rose-600" />
            <Kpi label="Resultado registado" value={eur(resultado)} note="Receitas − custos registados" icon={<Wallet className="h-4 w-4" />} tone={resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
            <Kpi label="Margem sobre receitas" value={receita ? `${margem.toFixed(1)}%` : '—'} note="Resultado ÷ receitas ativas" icon={<span className="font-bold">%</span>} tone="text-foreground" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
            <section className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">Evolução mensal</h2><p className="text-xs text-muted-foreground">Valores sem IVA</p></div><div className="flex gap-3 text-[10px] text-muted-foreground"><span>● Receita</span><span>● Custos</span></div></div>
              <div className="h-[280px] p-3">
                {monthly.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} /><Tooltip formatter={(v) => eur(Number(v))} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="receita" name="Receita" fill="#287b62" radius={[3, 3, 0, 0]} /><Bar dataKey="custos" name="Custos" fill="#c8b89f" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-muted-foreground">Sem movimentos no período</div>}
              </div>
            </section>
            <section className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Resultado por centro de custo</h2><p className="text-xs text-muted-foreground">Receita − custos registados</p></div>
              <div className="divide-y divide-border px-4">
                {centres.map((c) => <div key={c.centro} className="grid grid-cols-[72px_1fr_auto] items-center gap-2 py-3 text-xs"><b>{c.centro}</b><div className="space-y-1"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${receita ? Math.min(100, c.receita / receita * 100) : 0}%` }} /></div><span className="text-[10px] text-muted-foreground">R {eur(c.receita)} · C {eur(c.custos)}</span></div><b className={c.resultado >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{eur(c.resultado)}</b></div>)}
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Receita por categoria</h2><p className="text-xs text-muted-foreground">Faturas SAF-T ativas · sem IVA</p></div>
              <div className="divide-y divide-border px-4">{categories.length ? categories.map(([name, value]) => <div key={name} className="flex justify-between gap-4 py-3 text-xs"><span>{name}</span><b>{eur(value)} <span className="font-normal text-muted-foreground">({receita ? (value / receita * 100).toFixed(1) : '0.0'}%)</span></b></div>) : <p className="py-5 text-xs text-muted-foreground">Sem receita categorizada</p>}</div>
            </section>
            <section className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Estado dos documentos</h2><p className="text-xs text-muted-foreground">Anuladas preservadas, excluídas das receitas</p></div>
              <div className="grid grid-cols-2 gap-3 p-4"><div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">SAF-T ativas</div><div className="mt-1 text-lg font-semibold">{revenueRows.length}</div><div className="text-xs">{eur(receita)}</div></div><div className="rounded-lg bg-rose-500/5 p-3"><div className="text-xs text-muted-foreground">SAF-T anuladas</div><div className="mt-1 text-lg font-semibold">{cancelledRows.length}</div><div className="text-xs">fora dos totais</div></div></div>
              {uncategorizedPositive.length > 0 && <p className="px-4 pb-4 text-xs text-amber-700">{uncategorizedPositive.length} movimento(s) positivo(s) sem identificação SAF-T, excluídos da receita provisória.</p>}
            </section>
          </div>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Resumo mensal</h2><p className="text-xs text-muted-foreground">Receitas SAF-T ativas e custos com valor registado</p></div>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-2 text-left font-medium">Mês</th><th className="px-4 py-2 text-right font-medium">Receita s/ IVA</th><th className="px-4 py-2 text-right font-medium">Custos s/ IVA</th><th className="px-4 py-2 text-right font-medium">Resultado</th><th className="px-4 py-2 text-right font-medium">Margem</th></tr></thead><tbody className="divide-y divide-border">{monthly.map((r) => <tr key={r.month}><td className="px-4 py-3 font-medium">{monthLabel(r.month)}</td><td className="px-4 py-3 text-right text-emerald-700">{eur(r.receita)}</td><td className="px-4 py-3 text-right">{eur(r.custos)}</td><td className={`px-4 py-3 text-right font-semibold ${r.resultado >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{eur(r.resultado)}</td><td className="px-4 py-3 text-right text-muted-foreground">{r.receita ? `${(r.resultado / r.receita * 100).toFixed(1)}%` : '—'}</td></tr>)}</tbody></table></div>
          </section>
        </>}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: React.ReactNode; tone: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><span>{icon}</span></div><div className={`mt-2 font-display text-xl font-semibold ${tone}`}>{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{note}</div></div>;
}
