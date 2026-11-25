import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCentralWrites, useFinanceiro } from '@/hooks/useOperacoes';
import { NovoMovimento } from './NovoMovimento';
import { eur, ivaVenda, precoCompraFatura, precoVendaSemIva, resumoCarro, toNum } from '@/lib/operacoes/custos';
import type { Carro, Movimento } from '@/lib/operacoes/types';

const dataPt = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');

/** Valor c/ IVA (total) e s/ IVA de um movimento, sempre positivos. `semIva` null = só há o total. */
function valores(m: Movimento) {
  const total = Math.abs(toNum(m.valor));
  const semIva = m.valor_sem_iva != null && m.valor_sem_iva !== '' ? Math.abs(toNum(m.valor_sem_iva)) : null;
  return { total, semIva };
}

function Linhas({ titulo, movs, vazio }: { titulo: string; movs: Movimento[]; vazio: string }) {
  const tot = movs.reduce(
    (a, m) => {
      const v = valores(m);
      return { total: a.total + v.total, semIva: a.semIva + (v.semIva ?? v.total), soTotal: a.soTotal || v.semIva == null };
    },
    { total: 0, semIva: 0, soTotal: false },
  );
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">{titulo}</h4>
      {!movs.length ? (
        <p className="text-xs text-muted-foreground">{vazio}</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-1 text-left font-medium">Data</th>
              <th className="py-1 text-left font-medium">Descrição</th>
              <th className="py-1 text-right font-medium">c/ IVA</th>
              <th className="py-1 text-right font-medium">s/ IVA</th>
            </tr>
          </thead>
          <tbody>
            {movs.map((m) => {
              const v = valores(m);
              return (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="py-1 pr-2 align-top whitespace-nowrap">{dataPt(m.data)}</td>
                  <td className="py-1 pr-2 align-top">
                    {[m.categoria || m.tipo, m.descricao || m.contraparte].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="py-1 text-right align-top whitespace-nowrap">{eur(v.total)}</td>
                  <td className="py-1 text-right align-top whitespace-nowrap">
                    {v.semIva != null ? eur(v.semIva) : <span className="text-amber-500" title="Só foi registado o total">só total</span>}
                  </td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td className="py-1" colSpan={2}>Total</td>
              <td className="py-1 text-right whitespace-nowrap">{eur(tot.total)}</td>
              <td className="py-1 text-right whitespace-nowrap">{eur(tot.semIva)}{tot.soTotal && ' *'}</td>
            </tr>
            {tot.soTotal && (
              <tr>
                <td colSpan={4} className="pt-1 text-[11px] text-muted-foreground">
                  * Inclui o total c/ IVA dos movimentos sem valor s/ IVA registado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Linha({ label, cIva, sIva, nota }: { label: string; cIva: string; sIva: string; nota?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 border-b border-border/50 py-1 text-xs">
      <div>
        {label}
        {nota && <div className="text-[11px] text-muted-foreground">{nota}</div>}
      </div>
      <div className="text-right">{cIva}</div>
      <div className="text-right">{sIva}</div>
    </div>
  );
}

/** Margem bruta = valor final s/ IVA que fica para a Vianta (depois da comissão do investidor). */
function MargemViatura({ r }: { r: ReturnType<typeof resumoCarro> }) {
  const tom = (n: number) => (n < 0 ? 'text-destructive' : 'text-emerald-500');
  return (
    <section className="space-y-1 rounded-lg border border-border p-3">
      {r.investidor && (
        <>
          <div className="flex items-baseline justify-between text-xs">
            <span>Resultado s/ IVA (antes da comissão)</span>
            <span>{eur(r.margemBruta)}</span>
          </div>
          {r.pctInvestidor != null && (
            <div className="flex justify-between text-xs">
              <span>Comissão do investidor ({r.pctInvestidor}%)</span>
              <span>− {eur(r.comissaoInvestidor)}</span>
            </div>
          )}
        </>
      )}
      <div className="flex items-baseline justify-between border-t border-border pt-1 text-sm font-semibold">
        <span>Margem bruta (Vianta, s/ IVA)</span>
        {r.faltaPct ? <span className="text-amber-500">—</span> : <span className={tom(r.margem)}>{eur(r.margem)}</span>}
      </div>
      <div className="text-[11px] text-muted-foreground">
        Venda − compra − custos{r.investidor ? ' − comissão do investidor' : ''}, tudo s/ IVA.
      </div>
      {r.faltaPct && (
        <p className="text-[11px] text-amber-500">
          Falta a comissão do investidor (Características → Comissão do investidor).
        </p>
      )}
    </section>
  );
}

/**
 * Aba "Custos" da ficha da viatura: preço de venda c/ e s/ IVA, compra, custos e proveitos
 * registados no Financeiro, e o único sítio onde se registam custos novos da viatura
 * (sem ligação a tarefas). Não aplica regras de investidor nem de consignação (por definir).
 */
export function ContasViatura({ carro }: { carro: Carro }) {
  const { data: movs = [], isLoading } = useFinanceiro();
  const { create } = useCentralWrites('financeiro');
  const [aRegistar, setARegistar] = useState(false);
  if (isLoading) return <p className="py-6 text-sm text-muted-foreground">A carregar contas…</p>;

  const ms = movs.filter((m) => m.carro_id === carro.id);
  const faturasCompra = ms.filter((m) => m.tipo === 'Compra');
  const faturasVenda = ms.filter((m) => m.tipo === 'Venda');
  const custos = ms.filter((m) => toNum(m.valor) < 0 && m.tipo !== 'Compra');
  // A venda conta como proveito: as faturas de venda, ou, sem fatura, o preço da ficha
  // de uma viatura já vendida (s/ IVA pela taxa escolhida na ficha).
  const vendaDaFicha: Movimento[] =
    !faturasVenda.length && carro.estado === 'Vendido' && toNum(carro.preco_venda) > 0
      ? [
          {
            id: -carro.id,
            carro_id: carro.id,
            data: carro.data_venda || null,
            tipo: 'Venda',
            categoria: 'Venda da viatura',
            descricao: 'preço da ficha (sem fatura de venda)',
            contraparte: null,
            valor: toNum(carro.preco_venda),
            valor_sem_iva: precoVendaSemIva(carro),
            iva: null,
            kms: null,
            comprovativo: null,
            obs: null,
          } as Movimento,
        ]
      : [];
  const proveitos = [
    ...faturasVenda,
    ...vendaDaFicha,
    ...ms.filter((m) => toNum(m.valor) > 0 && m.tipo !== 'Venda'),
  ];
  const compraFatura = precoCompraFatura(ms);

  const vendaFatura = faturasVenda.reduce(
    (a, m) => {
      const v = valores(m);
      return { total: a.total + v.total, semIva: a.semIva + (v.semIva ?? v.total), soTotal: a.soTotal || v.semIva == null };
    },
    { total: 0, semIva: 0, soTotal: false },
  );
  const compraTotalFatura = faturasCompra.reduce((a, m) => a + valores(m).total, 0);

  const proprietario =
    carro.proprietario && carro.proprietario !== 'VIANTA' ? `Investidor (${carro.proprietario})` : carro.proprietario || '—';
  const consignacao = carro.aquisicao === 'Consignação';
  const resumo = resumoCarro(carro, ms);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>Proprietário: <b className="text-foreground">{proprietario}</b></span>
        <span>Aquisição: <b className="text-foreground">{carro.aquisicao || '—'}</b></span>
        <span>Gestão: <b className="text-foreground">{carro.tipo_gestao || '—'}</b></span>
        <span>Estado: <b className="text-foreground">{carro.estado || '—'}</b></span>
      </div>

      {consignacao && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600">
          Viatura à consignação: a regra de margem para estes casos ainda está por definir.
        </p>
      )}

      <section className="space-y-1">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[11px] font-medium text-muted-foreground">
          <div />
          <div className="text-right">c/ IVA</div>
          <div className="text-right">s/ IVA</div>
        </div>
        {faturasVenda.length ? (
          <Linha
            label="Venda (fatura de venda)"
            cIva={eur(vendaFatura.total)}
            sIva={eur(vendaFatura.semIva)}
            nota={vendaFatura.soTotal ? 'Há faturas só com o total registado' : undefined}
          />
        ) : (
          (() => {
            const preco = toNum(carro.preco_venda);
            const iva = ivaVenda(carro);
            const semIva = precoVendaSemIva(carro);
            return iva == null ? (
              <Linha
                label={`Preço de venda (ficha)${preco ? `: ${eur(preco)}` : ''}`}
                cIva="?"
                sIva="?"
                nota="Sem fatura de venda e sem taxa de IVA escolhida na ficha comercial (0% ou 23%)."
              />
            ) : (
              <Linha
                label={`Preço de venda (ficha, IVA ${iva}%)`}
                cIva={preco ? eur(preco) : '—'}
                sIva={preco && semIva != null ? eur(semIva) : '—'}
                nota="Sem fatura de venda: valor da ficha comercial."
              />
            );
          })()
        )}
        {compraFatura != null ? (
          <Linha label="Compra (fatura de compra)" cIva={eur(compraTotalFatura)} sIva={eur(compraFatura)} />
        ) : (
          <Linha
            label="Compra (ficha)"
            cIva="—"
            sIva={toNum(carro.preco_compra) ? eur(toNum(carro.preco_compra)) : '—'}
            nota={carro.aquisicao === 'Consignação' ? 'Consignação: sem fatura de compra' : 'Sem fatura de compra'}
          />
        )}
      </section>

      <div className="space-y-2">
        <div className="flex justify-end">
          {!aRegistar && (
            <Button type="button" size="sm" onClick={() => setARegistar(true)}>
              + Registar custo
            </Button>
          )}
        </div>
        {aRegistar && (
          <NovoMovimento
            carro={carro}
            busy={create.isPending}
            onCancel={() => setARegistar(false)}
            onSave={async (body) => {
              await create.mutateAsync(body);
              setARegistar(false);
              toast.success('Custo registado');
            }}
          />
        )}
        <Linhas titulo="Custos" movs={custos} vazio="Sem custos registados no Financeiro." />
      </div>
      <Linhas titulo="Proveitos (venda, aluguer, slot e outros)" movs={proveitos} vazio="Sem proveitos registados." />

      <MargemViatura r={resumo} />
    </div>
  );
}
