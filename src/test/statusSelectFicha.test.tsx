import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusSelect } from '@/components/operacoes/shared';
import type { Carro } from '@/lib/operacoes/types';

const updateCentralField = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/operacoes/central', () => ({
  updateCentralField: (...args: unknown[]) => updateCentralField(...args),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() },
}));

const carro = (extra: Partial<Carro>): Carro =>
  ({
    id: 1,
    estado: 'Em Preparação',
    combustivel: 'Gasóleo/Diesel',
    foto_url: 'https://exemplo.test/carro.jpg',
    ...extra,
  }) as Carro;

function montar(c: Carro) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <StatusSelect carro={c} />
    </QueryClientProvider>,
  );
  return utils.container.querySelector('select') as HTMLSelectElement;
}

function renderSelect(c: Carro, estado = 'Para Venda') {
  const select = montar(c);
  fireEvent.change(select, { target: { value: estado } });
  return select;
}

describe('StatusSelect — ficha obrigatória', () => {
  beforeEach(() => {
    updateCentralField.mockClear();
    toastError.mockClear();
  });

  it('bloqueia "Para Venda" quando falta a ficha e não grava nada', async () => {
    const select = renderSelect(carro({ tipo_gestao: 'Venda', caixa: 'Manual', cavalos: '130' }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(updateCentralField).not.toHaveBeenCalled();
    // o select volta ao estado anterior
    expect(select.value).toBe('Em Preparação');
    expect(String(toastError.mock.calls[0][0])).toContain('Categorias TVDE');
  });

  it('exige bateria e autonomia quando a viatura é elétrica', async () => {
    renderSelect(
      carro({
        tipo_gestao: 'Aluguer',
        combustivel: 'Elétrico',
        caixa: 'Automático',
        cavalos: '204',
        categorias_tvde: 'Eletric + Comfort',
        garantia_viatura: '8 anos',
        valor_aluguer_semanal: '295',
        caucao: '400',
      }),
      'Para Aluguer',
    );
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const msg = String(toastError.mock.calls[0][0]);
    expect(msg).toContain('Bateria (kWh)');
    expect(msg).toContain('Autonomia (km)');
    expect(updateCentralField).not.toHaveBeenCalled();
  });

  it('deixa passar e grava quando a ficha está completa', async () => {
    renderSelect(
      carro({
        tipo_gestao: 'Venda',
        caixa: 'Manual',
        cavalos: '130',
        categorias_tvde: 'X + Comfort',
        garantia_viatura: '3 anos',
        preco_venda: '24900',
        credito_120_meses: '210',
        credito_60_meses: '330',
        credito_48_meses: '390',
      }),
    );
    await waitFor(() => expect(updateCentralField).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(updateCentralField).toHaveBeenCalledWith('carros', 1, 'estado', 'Para Venda');
  });

  it('não interfere com estados que não exigem ficha', async () => {
    const select = montar(carro({}));
    fireEvent.change(select, { target: { value: 'Manutenção' } });
    await waitFor(() => expect(updateCentralField).toHaveBeenCalledWith('carros', 1, 'estado', 'Manutenção'));
    expect(toastError).not.toHaveBeenCalled();
  });
});
