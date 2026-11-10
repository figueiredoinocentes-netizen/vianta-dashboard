// Valida a guarda do servidor: uma viatura não passa a "Para Venda" / "Para Aluguer"
// através da API central sem a ficha preenchida, seja qual for o caminho do frontend.
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave-de-teste';

const { handler } = await import('../../netlify/functions/central.js');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const FICHA_COMPLETA = {
  id: 7,
  combustivel: 'Gasóleo/Diesel',
  cavalos: '130',
  caixa: 'Manual',
  categorias_tvde: 'X + Comfort',
  garantia_viatura: '3 anos',
  credito_120_meses: '210',
  credito_60_meses: '330',
  credito_48_meses: '390',
};

const put = (body: Record<string, unknown>) =>
  handler({
    httpMethod: 'PUT',
    headers: { origin: 'https://vianta-dashboard.netlify.app' },
    queryStringParameters: { type: 'carros' },
    body: JSON.stringify(body),
  });

const post = (body: Record<string, unknown>) =>
  handler({
    httpMethod: 'POST',
    headers: { origin: 'https://vianta-dashboard.netlify.app' },
    queryStringParameters: { type: 'carros' },
    body: JSON.stringify(body),
  });

const linhaAtual = (registo: Record<string, unknown>) => ({
  ok: true,
  json: async () => [registo],
});

const patchOk = () => ({ ok: true, json: async () => [{ updated: true }] });

describe('central.js — ficha obrigatória para passar a disponível', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('recusa "Para Venda" quando a linha na BD está incompleta', async () => {
    fetchMock.mockResolvedValueOnce(linhaAtual({ ...FICHA_COMPLETA, cavalos: null }));
    const res = await put({ id: 7, field: 'estado', value: 'Para Venda' });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error).toContain('Cavalos (cv)');
    expect(fetchMock).toHaveBeenCalledTimes(1); // não chegou a escrever
  });

  it('recusa "Para Aluguer" num elétrico sem bateria nem autonomia', async () => {
    fetchMock.mockResolvedValueOnce(linhaAtual({ ...FICHA_COMPLETA, combustivel: 'Elétrico' }));
    const res = await put({ id: 7, field: 'estado', value: 'Para Aluguer' });
    expect(res.statusCode).toBe(422);
    const erro = JSON.parse(res.body).error;
    expect(erro).toContain('Bateria (kWh)');
    expect(erro).toContain('Autonomia (km)');
  });

  it('aceita quando a ficha está completa e escreve o estado', async () => {
    fetchMock.mockResolvedValueOnce(linhaAtual(FICHA_COMPLETA)).mockResolvedValueOnce(patchOk());
    const res = await put({ id: 7, field: 'estado', value: 'Para Venda' });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain('/rest/v1/carros?id=eq.7');
    expect(init.body).toBe(JSON.stringify({ estado: 'Para Venda' }));
  });

  it('não valida nem lê a linha para estados sem ficha obrigatória', async () => {
    fetchMock.mockResolvedValueOnce(patchOk());
    const res = await put({ id: 7, field: 'estado', value: 'Manutenção' });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('não valida alterações a outros campos', async () => {
    fetchMock.mockResolvedValueOnce(patchOk());
    const res = await put({ id: 7, field: 'motorista_atual', value: 'Ana' });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('recusa criar uma viatura já em "Para Venda"', async () => {
    const res = await post({ matricula: 'AA-00-AA', estado: 'Para Venda' });
    expect(res.statusCode).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deixa criar uma viatura em preparação', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 9 }] });
    const res = await post({ matricula: 'AA-00-AA', estado: 'Em Preparação' });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
