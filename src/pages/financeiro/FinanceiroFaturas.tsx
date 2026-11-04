import { useMemo, useState } from 'react';
import { ExternalLink, Plus, RefreshCw, Search, X } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorBox, NativeSelect, hideCols } from '@/components/operacoes/shared';
import { FaturaDialog } from '@/components/financeiro/FaturaDialog';
import { FaturaThumb, FaturaViewer } from '@/components/financeiro/FaturaPreview';
import { useCarros, useFinanceiro, useRefreshOperacoes } from '@/hooks/useOperacoes';
import { eur } from '@/lib/operacoes/custos';
import type { Movimento } from '@/lib/operacoes/types';
import { CENTROS_CUSTO, eCusto, mesDe, naturezasSugeridas, nomeMes, valorSemIva } from '@/lib/financeiro';
import { cn } from '@/lib/utils';

const SEM_CENTRO = '__sem__';

const dataPt = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');

export default function FinanceiroFaturas() {
  const { data: movs = [], isLoading, isError } = useFinanceiro();
  const { data: carros = [] } = useCarros();
  const refresh = useRefreshOperacoes();

  const [search, setSearch] = useState('');
  const [centro, setCentro] = useState('');
  const [natureza, setNatureza] = useState('');
  const [mes, setMes] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; mov: Movimento | null }>({ open: false, mov: null });
  const [ver, setVer] = useState<Movimento | null>(null);

  const carroPorId = useMemo(() => new Map(carros.map((c) => [c.id, c])), [carros]);
  const custos = useMemo(
    () =>
      movs
        .filter(eCusto)
        .sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.id - a.id),
    [movs],
  );
  const naturezas = useMemo(() => naturezasSugeridas(movs), [movs]);
  const meses = useMemo(() => [...new Set(custos.map((m) => mesDe(m.data)).filter(Boolean))], [custos]);

  const lista = custos.filter((m) => {
    if (centro === SEM_CENTRO ? !!m.centro_custo : centro && m.centro_custo !== centro) return false;
    if (natureza && m.categoria !== natureza) return false;
    if (mes && mesDe(m.data) !== mes) return false;
    if (search) {
      const q = search.toLowerCase();
      const carro = m.carro_id != null ? carroPorId.get(m.carro_id) : undefined;
      const campos = [m.n_documento, m.descricao, m.contraparte, m.categoria, carro?.matricula, carro?.marca_modelo];
      if (!campos.some((c) => String(c || '').toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // Totais s/ IVA por centro de custo (respeitam os filtros de natureza e mês).
  const totais = useMemo(() => {
    const t: Record<string, number> = { [SEM_CENTRO]: 0 };
    for (const c of CENTROS_CUSTO) t[c] = 0;
    for (const m of custos) {
      if (natureza && m.categoria !== natureza) continue;
      if (mes && mesDe(m.data) !== mes) continue;
      t[m.centro_custo || SEM_CENTRO] = (t[m.centro_custo || SEM_CENTRO] || 0) + valorSemIva(m).valor;
    }
    return t;
  }, [custos, natureza, mes]);
  const totalLista = lista.reduce((a, m) => a + valorSemIva(m).valor, 0);

  const abrir = (mov: Movimento | null) => setDialog({ open: true, mov });

  return (
    <DashboardLayout>
      <div className="mb-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Faturas de custos • {lista.length} registos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>
              <RefreshCw /> Atualizar
            </Button>
            <Button onClick={() => abrir(null)}>
              <Plus /> Nova fatura
            </Button>
          </div>
        </div>

        {/* Totais por centro de custo (clicar filtra) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[...CENTROS_CUSTO, SEM_CENTRO].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCentro((atual) => (atual === c ? '' : c))}
              className={cn(
                'rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/60',
                centro === c ? 'border-primary bg-primary/10' : 'border-border',
              )}
            >
              <div className="text-xs text-muted-foreground">{c === SEM_CENTRO ? 'Sem centro de custo' : c}</div>
              <div className="mt-1 font-display text-lg font-semibold text-foreground">{eur(totais[c] || 0)}</div>
              <div className="text-[10px] text-muted-foreground">s/ IVA</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative sm:col-span-3 xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nº documento, descrição, fornecedor, matrícula…"
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar pesquisa"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <NativeSelect value={centro} onChange={(e) => setCentro(e.target.value)} aria-label="Centro de custo">
            <option value="">Todos os centros</option>
            {CENTROS_CUSTO.map((c) => (
              <option key={c}>{c}</option>
            ))}
            <option value={SEM_CENTRO}>Sem centro de custo</option>
          </NativeSelect>
          <NativeSelect value={natureza} onChange={(e) => setNatureza(e.target.value)} aria-label="Natureza do custo">
            <option value="">Todas as naturezas</option>
            {naturezas.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês">
            <option value="">Todos os meses</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {nomeMes(m)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {isError ? (
        <ErrorBox text="Erro ao carregar as faturas." />
      ) : isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !lista.length ? (
        <EmptyState icon="🧾" text="Nenhuma fatura de custo" />
      ) : (
        <div className={`rounded-xl border border-border bg-card ${hideCols(1, 5, 7, 8)}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº documento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição do serviço / produto</TableHead>
                <TableHead className="text-right">Valor s/ IVA</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead>Natureza do custo</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Viatura</TableHead>
                <TableHead>Fatura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((m) => {
                const v = valorSemIva(m);
                const carro = m.carro_id != null ? carroPorId.get(m.carro_id) : undefined;
                return (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => abrir(m)}>
                    <TableCell className="font-medium">{m.n_documento || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{dataPt(m.data)}</TableCell>
                    <TableCell>{m.descricao || ''}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold">
                      {eur(v.valor)}
                      {v.soTotal && (
                        <span className="ml-1 text-[10px] font-normal text-amber-500" title="Só foi registado o total c/ IVA">
                          c/ IVA
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.centro_custo || <span className="text-xs text-amber-500">por atribuir</span>}
                    </TableCell>
                    <TableCell>{m.categoria || ''}</TableCell>
                    <TableCell>{m.contraparte || ''}</TableCell>
                    <TableCell className="whitespace-nowrap">{carro?.matricula || ''}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {m.ficheiro ? (
                        <FaturaThumb path={m.ficheiro} nome={m.ficheiro_nome} onClick={() => setVer(m)} />
                      ) : m.comprovativo ? (
                        <a
                          href={m.comprovativo}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir comprovativo na Drive"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Drive
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total s/ IVA ({lista.length}):</span>
            <span className="font-bold text-foreground">{eur(totalLista)}</span>
          </div>
        </div>
      )}

      <FaturaViewer
        path={ver?.ficheiro || null}
        nome={ver?.ficheiro_nome}
        titulo={ver ? [ver.contraparte, ver.n_documento].filter(Boolean).join(' · ') : undefined}
        onClose={() => setVer(null)}
      />
      <FaturaDialog
        open={dialog.open}
        mov={dialog.mov}
        carros={carros}
        naturezas={naturezas}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </DashboardLayout>
  );
}
