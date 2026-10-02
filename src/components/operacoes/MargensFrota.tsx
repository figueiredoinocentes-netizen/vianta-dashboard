import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { eur, movsPreparacao, resumoCarro, semIva } from '@/lib/operacoes/custos';
import type { Carro } from '@/lib/operacoes/types';
import { useFinanceiro, useOcorrencias } from '@/hooks/useOperacoes';
import { useOps } from './OpsContext';
import { StatusBadge } from './shared';

type Filtro = 'todas' | 'Venda' | 'Aluguer' | 'vendidas';
const FILTROS: [Filtro, string][] = [
  ['todas', 'Todas'],
  ['Venda', 'Venda'],
  ['Aluguer', 'Aluguer'],
  ['vendidas', 'Vendidas'],
];

/** Margem por viatura (compra, custos, receita) a partir de `carros` + `financeiro`. */
export function MargensFrota({ carros }: { carros: Carro[] }) {
  const { openVehicle } = useOps();
  const { data: movs = [], isLoading } = useFinanceiro();
  const { data: ocorrencias = [] } = useOcorrencias();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [soComDados, setSoComDados] = useState(true);
  const [asc, setAsc] = useState(false);

  const linhas = useMemo(() => {
    return carros
      .filter((c) => c.tipo_gestao === 'Venda' || c.tipo_gestao === 'Aluguer')
      .map((c) => {
        const ms = movs.filter((m) => m.carro_id === c.id);
        const r = resumoCarro(c, ms);
        const prep = -movsPreparacao(ms, ocorrencias.filter((o) => o.carro_id === c.id)).reduce((a, m) => a + semIva(m), 0);
        const temDados = !!(r.compra || r.custos || r.receitas);
        return { c, r, prep, outros: r.custos - prep, temDados };
      })
      .filter((x) => (soComDados ? x.temDados : true))
      .filter((x) =>
        filtro === 'todas' ? true : filtro === 'vendidas' ? x.r.vendido : x.c.tipo_gestao === filtro,
      )
      .sort((a, b) => (asc ? a.r.margem - b.r.margem : b.r.margem - a.r.margem));
  }, [carros, movs, ocorrencias, filtro, soComDados, asc]);

  const tot = linhas.reduce(
    (t, x) => ({
      compra: t.compra + x.r.compra,
      custos: t.custos + x.r.custos,
      receita: t.receita + x.r.receita,
      margem: t.margem + x.r.margem,
    }),
    { compra: 0, custos: 0, receita: 0, margem: 0 },
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Margens por viatura</div>
          <div className="text-[11px] text-muted-foreground">
            Valores sem IVA. Venda: preço de venda − compra − custos. Aluguer: receitas − custos.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors ' +
                (filtro === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')
              }
            >
              {label}
            </button>
          ))}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={soComDados}
              onChange={(e) => setSoComDados(e.target.checked)}
              className="accent-[hsl(var(--primary))]"
            />
            só com dados
          </label>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Total label="Investido (compra)" value={eur(tot.compra)} />
        <Total label="Custos" value={eur(tot.custos)} />
        <Total label="Receitas" value={eur(tot.receita)} />
        <Total label="Margem" value={eur(tot.margem)} tone={tot.margem < 0 ? 'neg' : 'pos'} />
      </div>

      {isLoading ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : !linhas.length ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Ainda sem custos registados. Regista o preço de compra e os custos no separador Custos de cada
          viatura (em{' '}
          <Link to="/operacoes/frota" className="text-primary hover:underline">
            Frota Ativa
          </Link>
          ).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Viatura</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Compra</TableHead>
                <TableHead className="text-right">Preparação</TableHead>
                <TableHead className="text-right">Outros custos</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => setAsc((a) => !a)}
                  title="Ordenar"
                >
                  Margem {asc ? '▲' : '▼'}
                </TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(({ c, r, prep, outros }) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => openVehicle(c.id)}>
                  <TableCell>
                    <div className="font-semibold">{c.matricula || '-'}</div>
                    <div className="text-xs text-muted-foreground">{c.marca_modelo}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge estado={c.estado} />
                  </TableCell>
                  <TableCell className="text-right">{r.compra ? eur(r.compra) : '—'}</TableCell>
                  <TableCell className="text-right">{prep ? eur(prep) : '—'}</TableCell>
                  <TableCell className="text-right">{outros ? eur(outros) : '—'}</TableCell>
                  <TableCell className="text-right">{r.receita ? eur(r.receita) : '—'}</TableCell>
                  <TableCell
                    className={'text-right font-semibold ' + (r.margem < 0 ? 'text-destructive' : 'text-emerald-500')}
                  >
                    {eur(r.margem)}
                    {c.tipo_gestao === 'Venda' && !r.vendido && (
                      <div className="text-[10px] font-normal text-muted-foreground">prevista</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {r.receita ? `${Math.round((r.margem / r.receita) * 100)}%` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={
          'text-base font-semibold ' +
          (tone === 'neg' ? 'text-destructive' : tone === 'pos' ? 'text-emerald-500' : '')
        }
      >
        {value}
      </div>
    </div>
  );
}
