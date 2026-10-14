// Tempo parado das viaturas: períodos do log de estados (`carros_estados_log`) classificados por motivo
// a partir dos sinistros e das manutenções (`ocorrencias`) da viatura.
import type { Carro, EstadoLog, Ocorrencia, Sinistro } from './types';
import { concluido, ePreparacao } from './trabalhos';

/** Estados em que a viatura está parada (não gera receita). */
export const ESTADOS_PARADOS = ['Em Preparação', 'Para Aluguer', 'Para Venda', 'Manutenção'] as const;

export const MOTIVO_SINISTRO = 'Sinistro';
export const MOTIVO_SEM_TAREFA = 'Manutenção · sem tarefa registada';

const DIA = 86_400_000;
const ts = (d: string | null) => (d ? new Date(d).getTime() : NaN);
const overlap = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

export interface PeriodoParado {
  carroId: number;
  estado: string;
  motivo: string;
  inicio: number;
  fim: number;
  aberto: boolean;
  dias: number;
}

/** Motivo de um período parado: sinistro > tipo de manutenção em curso > sem tarefa > o próprio estado. */
function motivoDe(
  estado: string,
  inicio: number,
  fim: number,
  sinistros: Sinistro[],
  manutencoes: Ocorrencia[],
): { motivo: string; desde?: number } {
  let sin: number | undefined;
  for (const s of sinistros) {
    const a = ts(s.data_inicio);
    if (Number.isNaN(a)) continue;
    const b = s.data_fim ? ts(s.data_fim) + DIA : Infinity;
    if (overlap(inicio, fim, a, b)) sin = sin === undefined ? a : Math.min(sin, a);
  }
  if (sin !== undefined) return { motivo: MOTIVO_SINISTRO, desde: sin };
  if (estado !== 'Manutenção') return { motivo: estado };

  let melhor: { tipo: string; a: number } | null = null;
  for (const o of manutencoes) {
    const a = ts(o.data);
    if (Number.isNaN(a)) continue;
    const resolvido = ts(o.resolvido_em);
    const b = !Number.isNaN(resolvido) ? resolvido + DIA : concluido(o) ? a + DIA : Infinity;
    if (overlap(inicio, fim, a, b) && (!melhor || a > melhor.a)) melhor = { tipo: o.tipo || 'Outro', a };
  }
  return { motivo: melhor ? `Manutenção · ${melhor.tipo}` : MOTIVO_SEM_TAREFA };
}

/** Períodos parados (abertos e fechados) de todas as viaturas, com motivo e duração em dias. */
export function periodosParados(
  carros: Carro[],
  log: EstadoLog[],
  sinistros: Sinistro[],
  ocorrencias: Ocorrencia[],
): PeriodoParado[] {
  const agora = Date.now();
  const ids = new Set(carros.map((c) => c.id));
  const out: PeriodoParado[] = [];
  for (const l of log) {
    if (!ids.has(l.carro_id) || !(ESTADOS_PARADOS as readonly string[]).includes(l.estado || '')) continue;
    const estado = l.estado as string;
    const inicio0 = ts(l.desde);
    const fim = l.ate ? ts(l.ate) : agora;
    const { motivo, desde } = motivoDe(
      estado,
      inicio0,
      fim,
      sinistros.filter((s) => s.carro_id === l.carro_id),
      ocorrencias.filter((o) => o.carro_id === l.carro_id && !ePreparacao(o)),
    );
    // Sinistro anterior ao início do log: a data real do sinistro é a que conta.
    const inicio = motivo === MOTIVO_SINISTRO && desde !== undefined ? Math.min(inicio0, desde) : inicio0;
    out.push({
      carroId: l.carro_id,
      estado,
      motivo,
      inicio,
      fim,
      aberto: !l.ate,
      dias: Math.max(0, Math.floor((fim - inicio) / DIA)),
    });
  }
  return out;
}

export interface GrupoMotivo {
  motivo: string;
  n: number;
  media: number;
  total: number;
}

export function agruparPorMotivo(ps: PeriodoParado[]): GrupoMotivo[] {
  const m = new Map<string, PeriodoParado[]>();
  for (const p of ps) m.set(p.motivo, [...(m.get(p.motivo) || []), p]);
  return [...m.entries()]
    .map(([motivo, xs]) => {
      const total = xs.reduce((a, x) => a + x.dias, 0);
      return { motivo, n: xs.length, media: Math.round(total / xs.length), total };
    })
    .sort((a, b) => b.total - a.total);
}
