import { eur, semIva, toNum } from '@/lib/operacoes/custos';
import { useFinanceiro } from '@/hooks/useOperacoes';

const fmtData = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');

/** Todos os custos (tabela `financeiro`) ligados a uma manutenção/trabalho, com total. */
export function CustosTrabalho({ ocorrenciaId }: { ocorrenciaId: number }) {
  const { data: movs = [] } = useFinanceiro();
  const lista = movs
    .filter((m) => m.ocorrencia_id === ocorrenciaId)
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  if (!lista.length) {
    return <p className="text-xs text-muted-foreground">Sem custos registados nesta manutenção.</p>;
  }
  const totalSem = -lista.reduce((a, m) => a + semIva(m), 0);
  const totalCom = -lista.reduce((a, m) => a + toNum(m.valor), 0);

  return (
    <div className="flex flex-col gap-1.5">
      {lista.map((m) => (
        <div
          key={m.id}
          className="grid grid-cols-[1fr_auto] gap-x-3 rounded-md bg-muted/40 px-2 py-1.5 text-xs"
        >
          <div className="min-w-0">
            <div className="truncate font-medium">
              {m.categoria || 'Custo'}
              {m.descricao ? ` · ${m.descricao}` : ''}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {fmtData(m.data)}
              {m.contraparte ? ` · ${m.contraparte}` : ''}
              {m.kms ? ` · ${m.kms} km` : ''}
              {m.comprovativo && (
                <>
                  {' · '}
                  <a
                    href={m.comprovativo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    fatura
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{eur(-semIva(m))} s/ IVA</div>
            <div className="text-[11px] text-muted-foreground">{eur(-toNum(m.valor))} c/ IVA</div>
          </div>
        </div>
      ))}
      <div className="flex justify-between border-t border-border pt-1.5 text-xs font-semibold">
        <span>Total ({lista.length})</span>
        <span>
          {eur(totalSem)} s/ IVA · {eur(totalCom)} c/ IVA
        </span>
      </div>
    </div>
  );
}
