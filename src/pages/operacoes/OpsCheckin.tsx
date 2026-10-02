import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  destinoDepoisDePreparacao,
  getChecklist,
  getChecklistGroups,
  getMissingItems,
  matchesSearch,
} from '@/lib/operacoes/constants';
import type { Carro } from '@/lib/operacoes/types';
import { toast } from 'sonner';
import { updateCentralField } from '@/lib/operacoes/central';
import { ePreparacao, emAberto } from '@/lib/operacoes/trabalhos';
import type { Ocorrencia } from '@/lib/operacoes/types';
import {
  errorMessage,
  useCarros,
  useOcorrencias,
  useRefreshOperacoes,
  useToggleChecklistItem,
  useUpdateCarroField,
} from '@/hooks/useOperacoes';
import { useOps } from '@/components/operacoes/OpsContext';
import { EmptyState, ErrorBox, OpsHeader } from '@/components/operacoes/shared';

function PrevisaoBadge({ v }: { v: Carro }) {
  if (!v.data_previsao_pronto) return null;
  const d = new Date(`${v.data_previsao_pronto}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = d < today;
  return (
    <div
      className={cn(
        'inline-block self-start rounded px-2 py-0.5 text-xs',
        overdue ? 'bg-red-500/10 text-red-300' : 'bg-blue-500/10 text-blue-300',
      )}
    >
      📅 Previsto: {d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
    </div>
  );
}

function MissingTags({ v }: { v: Carro }) {
  const toggle = useToggleChecklistItem();
  const refresh = useRefreshOperacoes();
  const { data: ocorrencias = [] } = useOcorrencias();
  const done = v.checklist_prep || {};
  const docs = (getChecklistGroups(v).Documentos || []).filter((item) => !done[item]);
  const trabalhos = ocorrencias.filter((o) => o.carro_id === v.id && ePreparacao(o) && emAberto(o));

  const marcarFeito = async (e: React.MouseEvent, o: Ocorrencia) => {
    e.stopPropagation();
    try {
      await updateCentralField('ocorrencias', o.id, 'estado', 'Feito');
      await updateCentralField('ocorrencias', o.id, 'resolvido_em', new Date().toISOString().slice(0, 10));
      refresh();
    } catch (err) {
      toast.error(`Erro ao guardar: ${errorMessage(err)}`);
    }
  };

  const tagClass =
    'rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] text-amber-400 transition hover:border-amber-400 hover:bg-amber-950';
  return (
    <div className="space-y-2">
      {!!docs.length && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Documentos
          </div>
          <div className="flex flex-wrap gap-1.5">
            {docs.map((item) => (
              <button
                key={item}
                type="button"
                title="Clique para marcar como feito"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(v, item);
                }}
                className={tagClass}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
      {!!trabalhos.length && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            A Fazer
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trabalhos.map((o) => (
              <button
                key={o.id}
                type="button"
                title="Clique para marcar como feito (o custo regista-se na ficha da viatura)"
                onClick={(e) => marcarFeito(e, o)}
                className={tagClass}
              >
                {o.descricao || o.item || o.tipo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OpsCheckin() {
  const { search, openVehicle, openNovaViatura } = useOps();
  const { data: carros = [], isLoading, isError } = useCarros();
  const update = useUpdateCarroField();
  const { data: ocorrencias = [] } = useOcorrencias();
  const lista = carros.filter((v) => v.estado === 'Em Preparação').filter((v) => matchesSearch(search, v));

  return (
    <>
      <OpsHeader
        title="✅ Check-ins"
        count={lista.length}
        newLabel="Nova Viatura"
        onNew={openNovaViatura}
      />
      {isError ? (
        <ErrorBox text="Erro ao carregar as viaturas em preparação." />
      ) : isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !lista.length ? (
        <EmptyState icon="✅" text="Nenhuma viatura em preparação" />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {lista.map((v) => {
            const missing = getMissingItems(v);
            const abertos = ocorrencias.filter((o) => o.carro_id === v.id && ePreparacao(o) && emAberto(o));
            return (
              <div
                key={v.id}
                onClick={() => openVehicle(v.id)}
                className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-primary"
              >
                <div className="flex h-36 items-center justify-center overflow-hidden bg-sidebar">
                  {v.foto_url ? (
                    <img src={v.foto_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="opacity-25"
                    >
                      <path d="M5 17h14M5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 17l1.5-6.5A2 2 0 0 1 8.42 9h7.16a2 2 0 0 1 1.92 1.5L19 17M5 17V13m14 4V13M5 13h14" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <div>
                    <div className="font-display text-[15px] font-bold">
                      {v.marca_modelo || 'Sem modelo'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {v.matricula || 'Sem matrícula'} • {v.tipo_gestao || '-'}
                    </div>
                  </div>
                  <PrevisaoBadge v={v} />
                  {missing.length || abertos.length ? (
                    <MissingTags v={v} />
                  ) : getChecklist(v).length ? (
                    <div className="text-xs text-green-500">✓ Checklist completa</div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Sem checklist definida para {v.tipo_gestao || 'este tipo'}
                    </div>
                  )}
                  <div className="mt-auto pt-2">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        update(v, 'estado', destinoDepoisDePreparacao(v));
                      }}
                    >
                      Concluir Preparação
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
