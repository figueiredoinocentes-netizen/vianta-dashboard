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
  Sinistro,
  EstadoLog,
} from '@/lib/operacoes/types';

import { faltamParaEstado, mensagemCamposEmFalta } from '@/lib/operacoes/estadoRequisitos';

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
export const useSinistros = () => useCentralList<Sinistro>('sinistros');
export const useEstadosLog = () => useCentralList<EstadoLog>('estados_log');
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

/**
 * Muda o estado de uma viatura. Bloqueia a passagem a um estado disponível
 * enquanto faltarem os campos exigidos pelo tipo de gestão (incluindo pelo menos
 * uma fotografia; garantia só em Venda; valor semanal+caução em Aluguer).
 * As simulações de crédito são recomendadas em Venda, mas não bloqueiam o estado.
 * Devolve `false` quando bloqueou ou quando a gravação falhou.
 */
export function useAlterarEstado() {
  const update = useUpdateCarroField();
  return async (carro: Carro, estado: string): Promise<boolean> => {
    const faltam = faltamParaEstado(carro, estado);
    if (faltam.length) {
      toast.error(mensagemCamposEmFalta(faltam, estado), {
        description: 'Abre a viatura e preenche a Ficha comercial.',
        duration: 9000,
      });
      return false;
    }
    return update(carro, 'estado', estado);
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
