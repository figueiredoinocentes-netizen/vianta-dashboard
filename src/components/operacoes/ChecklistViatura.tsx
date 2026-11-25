import { toast } from 'sonner';
import { getChecklistGroups } from '@/lib/operacoes/constants';
import type { Carro } from '@/lib/operacoes/types';
import { errorMessage, useRefreshOperacoes, useUpdateCarroField } from '@/hooks/useOperacoes';
import { NativeSelect } from './shared';

/**
 * Aba "Checklist" da viatura: os pontos de verificação da preparação.
 * Desde 2026-11-25 a decisão só fica gravada em `carros.checklist_prep`; já não cria tarefas.
 */
export function ChecklistViatura({ carro }: { carro: Carro }) {
  const updateCarro = useUpdateCarroField();
  const refresh = useRefreshOperacoes();
  const itens = getChecklistGroups(carro)['A Fazer'] || [];

  async function decidir(item: string, decisao: string) {
    try {
      const checklist = { ...(carro.checklist_prep || {}), [item]: decisao };
      const ok = await updateCarro(carro, 'checklist_prep', checklist);
      if (!ok) return;
      refresh();
      toast.success('Checklist atualizada');
    } catch (e) {
      toast.error(`Erro ao atualizar a checklist: ${errorMessage(e)}`);
    }
  }

  if (!itens.length)
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Sem checklist definida para {carro.tipo_gestao || 'este tipo de gestão'}.
      </p>
    );

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 text-xs font-semibold">Checklist de verificação</div>
      <div className="space-y-2">
        {itens.map((item) => {
          const guardado = carro.checklist_prep?.[item];
          const valor = typeof guardado === 'string' ? guardado : 'por_confirmar';
          return (
            <div key={item} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">{item}</span>
              <NativeSelect
                className="h-8 w-auto min-w-44 text-xs"
                value={valor}
                onChange={(e) => void decidir(item, e.target.value)}
              >
                <option value="por_confirmar">Por confirmar</option>
                <option value="necessario">Necessário</option>
                <option value="nao_necessario">Não necessário</option>
              </NativeSelect>
            </div>
          );
        })}
      </div>
    </section>
  );
}
