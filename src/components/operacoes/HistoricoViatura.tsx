import { useMemo } from 'react';
import { useEstadosLog, useFinanceiro, useOcorrencias } from '@/hooks/useOperacoes';
import { eur, semIva } from '@/lib/operacoes/custos';
import { ORIGEM_PREP } from '@/lib/operacoes/trabalhos';
import type { Carro } from '@/lib/operacoes/types';
import { NomeViatura } from '@/components/operacoes/NomeViatura';

function dataPt(value?: string | null) {
  if (!value) return 'Data não registada';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: value.length > 10 ? 'short' : undefined });
}

export function HistoricoViatura({ carro }: { carro: Carro }) {
  const { data: estados = [], isLoading: estadosLoading } = useEstadosLog();
  const { data: ocorrencias = [], isLoading: ocorrenciasLoading } = useOcorrencias();
  const { data: financeiro = [] } = useFinanceiro();

  const eventos = useMemo(() => {
    const items: { key: string; date: string | null; title: string; detail?: string }[] = [];
    if (carro.data_compra) items.push({ key: 'compra', date: carro.data_compra, title: 'Compra da viatura' });
    if (carro.data_venda) items.push({ key: 'venda', date: carro.data_venda, title: 'Venda da viatura' });
    for (const e of estados.filter((x) => x.carro_id === carro.id)) {
      items.push({
        key: `estado-${e.id}`,
        date: e.desde,
        title: `Estado: ${e.estado || 'não especificado'}`,
        detail: e.ate ? `Até ${dataPt(e.ate)}` : 'Estado atual',
      });
    }
    for (const o of ocorrencias.filter((x) => x.carro_id === carro.id && !(x.origem === ORIGEM_PREP && x.item))) {
      const custos = financeiro.filter((m) => m.ocorrencia_id === o.id);
      const custoTotal = custos.reduce((sum, m) => sum + semIva(m), 0);
      const nome = o.descricao || o.item || o.tipo || 'Trabalho/ocorrência';
      items.push({
        key: `ocorrencia-${o.id}`,
        date: o.data,
        title: `${o.origem === 'Preparação' ? 'Preparação' : 'Trabalho'}: ${nome}`,
        detail: [o.estado, o.resolvido_em ? `Concluído ${dataPt(o.resolvido_em)}` : null, custos.length ? `Custos registados: ${eur(custoTotal)}` : null]
          .filter(Boolean).join(' · '),
      });
    }
    return items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [carro, estados, ocorrencias, financeiro]);

  if (estadosLoading || ocorrenciasLoading) return <p className="py-6 text-sm text-muted-foreground">A carregar histórico…</p>;
  if (!eventos.length) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Ainda não há movimentos registados para esta viatura.</p>;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Histórico de <NomeViatura carro={carro} fallback="viatura" />{carro.matricula ? ` — ${carro.matricula}` : ''}</h3>
      <ol className="relative ml-2 space-y-0 border-l border-border">
        {eventos.map((evento) => (
          <li key={evento.key} className="relative pb-4 pl-5 last:pb-0">
            <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-primary bg-background" />
            <div className="text-[11px] text-muted-foreground">{dataPt(evento.date)}</div>
            <div className="text-sm font-medium">{evento.title}</div>
            {evento.detail && <div className="text-xs text-muted-foreground">{evento.detail}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
