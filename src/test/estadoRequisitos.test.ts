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
  foto_url: 'https://exemplo.test/carro.jpg',
};

const VENDA_COMPLETA = {
  ...COMUM,
  tipo_gestao: 'Venda',
  garantia_viatura: '3 anos',
  preco_venda: '24900',
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

  it('Venda exige preço e garantia, mas não caução nem simulação de crédito', () => {
    expect(labels(camposObrigatorios(VENDA_COMPLETA, 'Para Venda'))).toEqual([
      'Cavalos (cv)',
      'Caixa',
      'Categorias TVDE',
      'Fotos da viatura',
      'Garantia viatura',
      'Preço de venda',
    ]);
    expect(faltamParaEstado(VENDA_COMPLETA, 'Para Venda')).toEqual([]);
    expect(labels(faltamParaEstado({ ...VENDA_COMPLETA, preco_venda: '' }, 'Para Venda'))).toEqual(['Preço de venda']);
  });

  it('Aluguer exige valor semanal e caução, mas não garantia nem crédito', () => {
    expect(labels(camposObrigatorios(ALUGUER_COMPLETO, 'Para Aluguer'))).toEqual([
      'Cavalos (cv)',
      'Caixa',
      'Categorias TVDE',
      'Fotos da viatura',
      'Valor do aluguer semanal',
      'Caução',
    ]);
    expect(faltamParaEstado(ALUGUER_COMPLETO, 'Para Aluguer')).toEqual([]);
    expect(labels(faltamParaEstado({ ...ALUGUER_COMPLETO, caucao: '' }, 'Para Aluguer'))).toEqual(['Caução']);
  });

  it('Venda e Aluguer exige os dois conjuntos, incluindo garantia', () => {
    expect(faltamParaEstado(MISTO_COMPLETO, 'Para Venda e Aluguer')).toEqual([]);
    expect(labels(faltamParaEstado({ ...MISTO_COMPLETO, garantia_viatura: '', caucao: '' }, 'Para Venda e Aluguer'))).toEqual([
      'Garantia viatura',
      'Caução',
    ]);
  });

  it('exige pelo menos uma foto, aceitando foto_url ou a lista fotos', () => {
    expect(labels(faltamParaEstado({ ...VENDA_COMPLETA, foto_url: null }, 'Para Venda'))).toEqual(['Fotos da viatura']);
    expect(faltamParaEstado({ ...VENDA_COMPLETA, foto_url: null, fotos: ['https://exemplo.test/1.jpg'] }, 'Para Venda')).toEqual([]);
    expect(labels(faltamParaEstado({ ...ALUGUER_COMPLETO, foto_url: '', fotos: [] }, 'Para Aluguer'))).toEqual(['Fotos da viatura']);
  });

  it('exige segundo combustível e estado plug-in para híbridos antes de entrar em stock', () => {
    const hibrido = { ...VENDA_COMPLETA, combustivel: 'Híbrido' };
    expect(labels(faltamParaEstado(hibrido, 'Para Venda'))).toContain('Segundo combustível');
    expect(labels(faltamParaEstado(hibrido, 'Para Venda'))).toContain('Plug-in (Sim/Não)');
    expect(faltamParaEstado({ ...hibrido, combustivel_secundario: 'Gasolina', plug_in: false }, 'Para Venda')).toEqual([]);
    expect(faltamParaEstado({ ...ALUGUER_COMPLETO, combustivel: 'Híbrido', combustivel_secundario: 'Gasolina', plug_in: true }, 'Para Aluguer')).toEqual([]);
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
