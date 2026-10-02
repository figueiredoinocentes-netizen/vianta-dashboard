import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createCentral,
  deleteCentral,
  listCentral,
  updateCentralField,
  type CentralType,
} from '@/lib/operacoes/central';
import type {
  ArmazemItem,
  Carro,
  Cliente,
  Investidor,
  Motorista,
  Movimento,
  Ocorrencia,
  Pagamento,
} from '@/lib/operacoes/types';

import { ORIGEM_PREP, itensPreparacao, tipoDoItem } from '@/lib/operacoes/trabalhos';

const KEY = 'central';

function useCentralList<T>(type: CentralType) {
  return useQuery({
    queryKey: [KEY, type],
    queryFn: () => listCentral<T>(type),
    staleTime: 30_000,
  });
}

export const useCarros = () => useCentralList<Carro>('carros');
export const useArmazem = () => useCentralList<ArmazemItem>('armazem');
export const useMotoristas = () => useCentralList<Motorista>('motoristas');
export const useInvestidores = () => useCentralList<Investidor>('investidores');
export const useClientes = () => useCentralList<Cliente>('clientes');
export const usePagamentos = () => useCentralList<Pagamento>('pagamentos');

export const useOcorrencias = () => useCentralList<Ocorrencia>('ocorrencias');
export const useFinanceiro = () => useCentralList<Movimento>('financeiro');

export function useRefreshOperacoes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

/** Atualiza um campo de uma viatura e reflete-o logo na cache. */
export function useUpdateCarroField() {
  const qc = useQueryClient();
  return async (carro: Carro, field: string, value: unknown): Promise<boolean> => {
    try {
      await updateCentralField('carros', carro.id, field, value);
      qc.setQueryData<Carro[]>([KEY, 'carros'], (old) =>
        (old || []).map((c) => (c.id === carro.id ? { ...c, [field]: value } : c)),
      );
      return true;
    } catch (e) {
      toast.error(`Erro ao guardar: ${errorMessage(e)}`);
      return false;
    }
  };
}

/** Criar / apagar registos. Recarrega a lista correspondente no fim. */
export function useCentralWrites(type: CentralType) {
  const qc = useQueryClient();
  const reload = () => qc.invalidateQueries({ queryKey: [KEY, type] });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => createCentral(type, body),
    onSuccess: reload,
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteCentral(type, id),
    onSuccess: reload,
  });
  return { create, remove, reload };
}


/** Marca/desmarca um item da checklist de preparação de uma viatura. */
export function useToggleChecklistItem() {
  const update = useUpdateCarroField();
  return (carro: Carro, item: string) => {
    const done = { ...(carro.checklist_prep || {}) };
    done[item] = !done[item];
    return update(carro, 'checklist_prep', done);
  };
}

// Viaturas com a criação dos trabalhos de preparação em curso / que já falharam nesta sessão.
const preparacaoEmCurso = new Set<number>();
const preparacaoFalhou = new Set<number>();

/**
 * Quando uma viatura está "Em Preparação" e ainda não tem trabalhos de preparação,
 * cria-os a partir dos itens "A Fazer" da checklist (já feitos na checklist antiga ficam "Feito").
 */
export function useAutoTrabalhosPreparacao() {
  const qc = useQueryClient();
  const { data: carros } = useCarros();
  const { data: ocorrencias, isSuccess } = useOcorrencias();

  useEffect(() => {
    if (!carros || !ocorrencias || !isSuccess) return;
    for (const c of carros) {
      if (c.estado !== 'Em Preparação') continue;
      if (preparacaoEmCurso.has(c.id) || preparacaoFalhou.has(c.id)) continue;
      if (ocorrencias.some((o) => o.carro_id === c.id && o.origem === ORIGEM_PREP)) continue;
      const itens = itensPreparacao(c);
      if (!itens.length) continue;
      const feitos = c.checklist_prep || {};
      const hoje = new Date().toISOString().slice(0, 10);
      preparacaoEmCurso.add(c.id);
      createCentral(
        'ocorrencias',
        itens.map((item) => ({
          carro_id: c.id,
          origem: ORIGEM_PREP,
          item,
          tipo: tipoDoItem(item),
          descricao: item,
          gravidade: 'Baixa',
          estado: feitos[item] ? 'Feito' : 'Por fazer',
          resolvido_em: feitos[item] ? hoje : null,
        })),
      )
        .then(() => qc.invalidateQueries({ queryKey: [KEY, 'ocorrencias'] }))
        .catch(() => preparacaoFalhou.add(c.id))
        .finally(() => preparacaoEmCurso.delete(c.id));
    }
  }, [carros, ocorrencias, isSuccess, qc]);
}
