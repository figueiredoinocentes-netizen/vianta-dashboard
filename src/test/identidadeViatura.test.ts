import { describe, expect, it } from 'vitest';
import { marcasRegistadas, nomeCarro, splitMarcaModelo } from '@/lib/operacoes/identidadeViatura';

describe('identidade da viatura', () => {
  it('separa a marca conhecida dos valores legados', () => {
    expect(splitMarcaModelo({ marca: null, marca_modelo: 'BYD ATTO 3' })).toEqual({
      marca: 'BYD',
      modelo: 'ATTO 3',
    });
  });

  it('mantém marca e modelo já separados', () => {
    expect(splitMarcaModelo({ marca: 'Volvo', marca_modelo: 'XC40' })).toEqual({
      marca: 'Volvo',
      modelo: 'XC40',
    });
  });

  it('junta marca, modelo e versão numa única etiqueta com espaços', () => {
    expect(nomeCarro({ marca: 'VW', marca_modelo: 'ID.5', versao: 'Pro' })).toBe('VW ID.5 Pro');
  });

  it('gera sugestões únicas de marcas a partir dos registos', () => {
    const cars = [
      { marca: null, marca_modelo: 'BYD Seal' },
      { marca: null, marca_modelo: 'BYD ATTO 3' },
      { marca: 'Volvo', marca_modelo: 'XC40' },
    ];
    expect(marcasRegistadas(cars)).toEqual(['BYD', 'Volvo']);
  });
});
