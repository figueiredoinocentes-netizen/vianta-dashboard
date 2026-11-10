// Valida a guarda do servidor: uma viatura não passa a disponível
// através da API central sem a ficha exigida pelo seu tipo de gestão.
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave-de-teste';

const { handler } = await import('../../netlify/functions/central.js');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const COMUM = {
  id: 7,
  combustivel: 'Gasóleo/Diesel',
  cavalos: '130',
  caixa: 'Manual',
  categorias_tvde: 'X + Comfort',
  garantia_viatura: '3 anos',
};
const VENDA = {
  ...COMUM,
  tipo_gestao: 'Venda',
  preco_venda: '24900',
  credito_120_meses: '210',
  credito_60_meses: '330',
  credito_48_meses: '390',
};
const ALUGUER = {
  ...COMUM,
  tipo_gestao: 'Aluguer',
  valor_aluguer_semanal: '295',
  caucao: '400',
};
const MISTO = {
  ...VENDA,
  tipo_gestao: 'Venda e Aluguer',
  valor_aluguer_semanal: '295',
  caucao: '400',
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

const linhaAtual = (registo: Record<string, unknown>) => ({ ok: true, json: async () => [registo] });
const patchOk = () => ({ ok: true, json: async () => [{ updated: true }] });

describe('central.js — ficha obrigatória para passar a disponível', () => {
  beforeEach(() => fetchMock.mockReset());

  it('recusa Venda sem preço de venda', async () => {
    fetchMock.mockResolvedValueOnce(linhaAtual({ ...VENDA, preco_venda: null }));
    const res = await put({ id: 7, field: 'estado', value: 'Para Venda' });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error).toContain('Preço de venda');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Venda exige crédito mas não exige caução nem aluguer', async () => {
    fetchMock.mockResolvedValueOnce(linhaAtual(VENDA)).mockResolvedValueOnce(patchOk());
    const res = await put({ id: 7, field: 'estado', value: 'Para Venda' });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Aluguer exige valor semanal e caução mas não exige crédito', async () => {
    fetchMock.mockResolvedValueOnce(linhaAtual({ ...ALUGUER, caucao: null }));
    const recusado = await put({ id: 7, field: 'estado', value: 'Para Aluguer' });
    expect(recusado.statusCode).toBe(422);
    expect(JSON.parse(recusado.body).error).toContain('Caução');
    expect(JSON.parse(recusado.body).error).not.toContain('crédito');

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(linhaAtual(ALUGUER)).mockResolvedValueOnce(patchOk());
    const aceite = await put({ id: 7, field: 'estado', value: 'Para Aluguer' });
    expect(aceite.statusCode).toBe(200);
  });

  it('misto exige venda, aluguer, caução e crédito', async () => {
    fetchMock.mockResolvedValueOnce(linhaAtual({ ...MISTO, caucao: null, credito_60_meses: null }));
    const res = await put({ id: 7, field: 'estado', value: 'Para Venda e Aluguer' });
    expect(res.statusCode).toBe(422);
    const erro = JSON.parse(res.body).error;
    expect(erro).toContain('Caução');
    expect(erro).toContain('Simulação de crédito — 60 meses');
  });

  it('recusa elétrico de aluguer sem bateria nem autonomia', async () => {
    fetchMock.mockResolvedValueOnce(linhaAtual({ ...ALUGUER, combustivel: 'Elétrico' }));
    const res = await put({ id: 7, field: 'estado', value: 'Para Aluguer' });
    expect(res.statusCode).toBe(422);
    const erro = JSON.parse(res.body).error;
    expect(erro).toContain('Bateria (kWh)');
    expect(erro).toContain('Autonomia (km)');
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

  it('recusa criar uma viatura de aluguer já disponível sem ficha', async () => {
    const res = await post({ matricula: 'AA-00-AA', tipo_gestao: 'Aluguer', estado: 'Para Aluguer' });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error).toContain('Valor do aluguer semanal');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deixa criar uma viatura em preparação', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 9 }] });
    const res = await post({ matricula: 'AA-00-AA', estado: 'Em Preparação' });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
