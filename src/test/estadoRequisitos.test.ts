import { describe, expect, it } from 'vitest';
import {
  camposEmFalta,
  camposObrigatorios,
  eEletrico,
  faltamParaEstado,
  mensagemCamposEmFalta,
} from '@/lib/operacoes/estadoRequisitos';

const COMUM = {
  combustivel: 'Gasóleo/Diesel',
  cavalos: '130',
  caixa: 'Manual',
  categorias_tvde: 'X + Comfort',
  garantia_viatura: '3 anos',
};

const VENDA_COMPLETA = {
  ...COMUM,
  tipo_gestao: 'Venda',
  preco_venda: '24900',
  credito_120_meses: '210',
  credito_60_meses: '330',
  credito_48_meses: '390',
};

const ALUGUER_COMPLETO = {
  ...COMUM,
  tipo_gestao: 'Aluguer',
  valor_aluguer_semanal: '295',
  caucao: '400',
};

const MISTO_COMPLETO = {
  ...VENDA_COMPLETA,
  tipo_gestao: 'Venda e Aluguer',
  valor_aluguer_semanal: '295',
  caucao: '400',
};

const labels = (faltam: { label: string }[]) => faltam.map((f) => f.label);

describe('estadoRequisitos', () => {
  it('não exige nada para estados que não são de disponibilidade', () => {
    expect(faltamParaEstado({}, 'Alugado')).toEqual([]);
    expect(faltamParaEstado({}, 'Em Preparação')).toEqual([]);
    expect(faltamParaEstado(VENDA_COMPLETA, null)).toEqual([]);
  });

  it('Venda exige preço e as 3 simulações, mas não aluguer nem caução', () => {
    expect(labels(camposObrigatorios({ ...VENDA_COMPLETA, preco_venda: '' }, 'Para Venda'))).toEqual([
      'Cavalos (cv)',
      'Caixa',
      'Categorias TVDE',
      'Garantia viatura',
      'Preço de venda',
      'Simulação de crédito — 120 meses',
      'Simulação de crédito — 60 meses',
      'Simulação de crédito — 48 meses',
    ]);
    expect(labels(faltamParaEstado({ ...VENDA_COMPLETA, preco_venda: '' }, 'Para Venda'))).toEqual(['Preço de venda']);
    expect(faltamParaEstado(VENDA_COMPLETA, 'Para Venda')).toEqual([]);
  });

  it('Aluguer exige valor semanal e caução, mas não preço nem crédito', () => {
    expect(labels(camposObrigatorios(ALUGUER_COMPLETO, 'Para Aluguer'))).toEqual([
      'Cavalos (cv)',
      'Caixa',
      'Categorias TVDE',
      'Garantia viatura',
      'Valor do aluguer semanal',
      'Caução',
    ]);
    expect(faltamParaEstado(ALUGUER_COMPLETO, 'Para Aluguer')).toEqual([]);
    expect(labels(faltamParaEstado({ ...ALUGUER_COMPLETO, caucao: '' }, 'Para Aluguer'))).toEqual(['Caução']);
  });

  it('Venda e Aluguer exige os dois conjuntos comerciais', () => {
    expect(faltamParaEstado(MISTO_COMPLETO, 'Para Venda e Aluguer')).toEqual([]);
    expect(labels(faltamParaEstado({ ...MISTO_COMPLETO, preco_venda: '', caucao: '' }, 'Para Venda e Aluguer'))).toEqual([
      'Preço de venda',
      'Caução',
    ]);
  });

  it('o tipo misto exige os dois conjuntos mesmo se escolher Para Venda', () => {
    expect(labels(faltamParaEstado({ ...MISTO_COMPLETO, valor_aluguer_semanal: '' }, 'Para Venda'))).toEqual([
      'Valor do aluguer semanal',
    ]);
  });

  it('num elétrico exige bateria e autonomia em qualquer oferta', () => {
    const eletrico = { ...ALUGUER_COMPLETO, combustivel: 'Elétrico' };
    expect(labels(faltamParaEstado(eletrico, 'Para Aluguer'))).toEqual([
      'Bateria (kWh)',
      'Autonomia (km)',
    ]);
    expect(faltamParaEstado({ ...eletrico, bateria_kwh: '77', autonomia_km: '500' }, 'Para Aluguer')).toEqual([]);
  });

  it('permite descobrir faltas no Stock antes da mudança de estado', () => {
    expect(labels(camposEmFalta({ ...ALUGUER_COMPLETO, caucao: '' }))).toEqual(['Caução']);
    expect(camposEmFalta({ tipo_gestao: 'Slot' })).toEqual([]);
  });

  it('trata espaços em branco como campo vazio', () => {
    expect(labels(faltamParaEstado({ ...VENDA_COMPLETA, cavalos: '   ' }, 'Para Venda'))).toEqual(['Cavalos (cv)']);
  });

  it('reconhece os combustíveis elétricos escritos com ou sem acento', () => {
    expect(eEletrico({ combustivel: 'Elétrico' })).toBe(true);
    expect(eEletrico({ combustivel: 'eletrico' })).toBe(true);
    expect(eEletrico({ combustivel: 'Híbrido' })).toBe(false);
    expect(eEletrico({})).toBe(false);
  });

  it('escreve a mensagem com o estado e os campos em falta', () => {
    expect(mensagemCamposEmFalta([{ campo: 'cavalos', label: 'Cavalos (cv)' }], 'Para Venda')).toBe(
      'Para passar a «Para Venda» falta preencher: Cavalos (cv).',
    );
  });
});
