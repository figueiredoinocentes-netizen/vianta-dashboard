import { describe, expect, it } from 'vitest';
import {
  camposObrigatorios,
  eEletrico,
  faltamParaEstado,
  mensagemCamposEmFalta,
} from '@/lib/operacoes/estadoRequisitos';

const FICHA_COMPLETA = {
  combustivel: 'Gasóleo/Diesel',
  cavalos: '130',
  caixa: 'Manual',
  categorias_tvde: 'X + Comfort',
  garantia_viatura: '3 anos',
  credito_120_meses: '210',
  credito_60_meses: '330',
  credito_48_meses: '390',
};

const labels = (faltam: { label: string }[]) => faltam.map((f) => f.label);

describe('estadoRequisitos', () => {
  it('não exige nada para estados que não são Para Venda nem Para Aluguer', () => {
    expect(faltamParaEstado({}, 'Alugado')).toEqual([]);
    expect(faltamParaEstado({}, 'Em Preparação')).toEqual([]);
    expect(faltamParaEstado(FICHA_COMPLETA, null)).toEqual([]);
  });

  it('num carro a combustão não exige bateria nem autonomia', () => {
    expect(labels(camposObrigatorios(FICHA_COMPLETA))).toEqual([
      'Cavalos (cv)',
      'Caixa',
      'Categorias TVDE',
      'Garantia viatura',
      'Simulação de crédito — 120 meses',
      'Simulação de crédito — 60 meses',
      'Simulação de crédito — 48 meses',
    ]);
  });

  it('num elétrico exige bateria e autonomia', () => {
    const eletrico = { ...FICHA_COMPLETA, combustivel: 'Elétrico' };
    expect(labels(faltamParaEstado(eletrico, 'Para Aluguer'))).toEqual([
      'Bateria (kWh)',
      'Autonomia (km)',
    ]);
    expect(faltamParaEstado({ ...eletrico, bateria_kwh: '77', autonomia_km: '500km' }, 'Para Aluguer')).toEqual([]);
  });

  it('lista todos os campos em falta numa viatura vazia', () => {
    expect(labels(faltamParaEstado({}, 'Para Venda'))).toEqual([
      'Cavalos (cv)',
      'Caixa',
      'Categorias TVDE',
      'Garantia viatura',
      'Simulação de crédito — 120 meses',
      'Simulação de crédito — 60 meses',
      'Simulação de crédito — 48 meses',
    ]);
  });

  it('trata espaços em branco como campo vazio', () => {
    expect(labels(faltamParaEstado({ ...FICHA_COMPLETA, cavalos: '   ' }, 'Para Venda'))).toEqual([
      'Cavalos (cv)',
    ]);
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
