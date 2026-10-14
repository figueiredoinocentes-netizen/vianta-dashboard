// Declaração de circulação (venda de viatura):
//  GET  ?action=clientes                 → pastas de clientes em AQUISIÇÃO/Vendas/Pedidos Financiamento
//  POST {action:'cliente', folderId}     → lê os documentos do cliente e extrai nome, documento e morada
//  POST {action:'carro', folderId}       → lê os documentos da viatura e extrai os dados do veículo
//  POST {action:'criar', folderId, nome, dados} → cria o Google Doc na pasta da viatura
// Auth Drive: service account (netlify/lib/drive-auth.js). Extração: OpenRouter (modelo Anthropic) — OPENROUTER_API_KEY.
import { DRIVE_WRITE_SCOPE, FOLDER_MIME, driveDownload, driveList, getAccessToken } from '../lib/drive-auth.js';

const PROD_ORIGIN = 'https://vianta-dashboard.netlify.app';
const PREVIEW_ORIGIN_RE = /^https:\/\/[a-z0-9-]+--vianta-dashboard\.netlify\.app$/;
const MODEL = 'anthropic/claude-sonnet-5.5';
const MAX_BYTES = 4_500_000;

function resolveOrigin(event) {
  const origin = (event.headers || {}).origin || (event.headers || {}).Origin;
  if (origin && (origin === PROD_ORIGIN || PREVIEW_ORIGIN_RE.test(origin))) return origin;
  return PROD_ORIGIN;
}

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
});

const reply = (origin, statusCode, body) => ({ statusCode, headers: cors(origin), body: JSON.stringify(body) });

async function findPedidosFolder(token) {
  const q =
    `(name contains 'Pedidos Financiamento' or name contains 'Pedidos de Financiamento') ` +
    `and mimeType='${FOLDER_MIME}' and trashed=false`;
  const r = await driveList(token, q, 'files(id,name)');
  return (r.files || [])[0] || null;
}

const IMG = /^image\/(jpeg|png|webp|gif)$/;
const lerivel = (f) => (f.mimeType === 'application/pdf' || IMG.test(f.mimeType)) && Number(f.size || 0) <= MAX_BYTES;
const nome = (f) => (f.name || '').toLowerCase();

function escolherFicheiros(files, tipo) {
  const ok = files.filter(lerivel);
  if (tipo === 'carro') {
    const re = /dua|livrete|documento [uú]nico|registo|propriedade|certificado|coc|ficha t[eé]cnica|inspe[cç]/;
    const m = ok.filter((f) => re.test(nome(f)));
    return (m.length ? m : ok).slice(0, 4);
  }
  const irrelevante = /irs|recibo|extrato|contrato|nib|iban|atividade|domic[ií]lio fiscal|banco|vencimento|segur/;
  const ident = /cart[aã]o|cidad|identifica|\bcc\b|passaporte|resid[eê]ncia|t[ií]tulo/;
  const morada = /morada|resid[eê]ncia|domic/;
  const a = ok.filter((f) => ident.test(nome(f)));
  const b = ok.filter((f) => morada.test(nome(f)) && !a.includes(f));
  const picked = [...a, ...b];
  if (picked.length) return picked.slice(0, 6);
  // Nomes genéricos ("Documento 3"): tenta os que não parecem financeiros.
  return ok.filter((f) => !irrelevante.test(nome(f))).slice(0, 6);
}

const PROMPTS = {
  cliente:
    'Estes documentos pertencem a um cliente que comprou uma viatura. Extrai: nome completo, tipo e número do ' +
    'documento de identificação (Cartão de Cidadão, passaporte ou título de residência), NIF e morada completa ' +
    '(rua, número, código-postal e localidade; usa o comprovativo de morada se existir, senão o documento de identificação). ' +
    'Responde APENAS com JSON: {"nome":"","tipo_documento":"","numero_documento":"","nif":"","morada":"","notas":""}. ' +
    'Usa "" para o que não encontrares com certeza; não inventes. Em "notas" indica dúvidas ou ilegibilidade.',
  carro:
    'Estes documentos pertencem a uma viatura. Extrai os dados do veículo. Responde APENAS com JSON: ' +
    '{"matricula":"","categoria":"","ano":"","marca":"","modelo":"","combustivel":"","cor":"","cilindrada":"","lotacao":"","chassis":"","notas":""}. ' +
    'Categoria como "Ligeiro Passageiros"; usa "" para o que não encontrares com certeza; não inventes. ' +
    'Em "notas" indica dúvidas ou ilegibilidade.',
};

async function extrair(token, folderId, tipo) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    const e = new Error('OPENROUTER_API_KEY não está configurada no Netlify');
    e.status = 501;
    throw e;
  }
  const lista = await driveList(
    token,
    `'${folderId}' in parents and mimeType != '${FOLDER_MIME}' and trashed=false`,
    'files(id,name,mimeType,size)',
  );
  const files = escolherFicheiros(lista.files || [], tipo);
  if (!files.length) return { dados: {}, fontes: [], aviso: 'Sem documentos legíveis (PDF/JPG/PNG) nesta pasta.' };

  const content = [];
  for (const f of files) {
    const data = (await driveDownload(token, f.id)).toString('base64');
    content.push(
      f.mimeType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
        : { type: 'image', source: { type: 'base64', media_type: f.mimeType, data } },
    );
    content.push({ type: 'text', text: `(ficheiro acima: ${f.name})` });
  }
  content.push({ type: 'text', text: PROMPTS[tipo] });

  const res = await fetch('https://openrouter.ai/api/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) {
    console.error('OpenRouter error:', res.status, await res.text());
    throw new Error('Erro ao ler os documentos');
  }
  const out = await res.json();
  const text = (out.content || []).map((c) => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  let dados = {};
  try {
    dados = m ? JSON.parse(m[0]) : {};
  } catch {
    dados = {};
  }
  return { dados, fontes: files.map((f) => f.name) };
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** Texto do modelo "DECLARAÇÃO CIRCULAÇÃO" da Vianta (Dos Inocentes, Lda). */
function htmlDeclaracao(d) {
  const hoje = new Date();
  const data = d.data || `${hoje.getDate()} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  const doc = [d.tipo_documento || 'Cartão de Cidadão', d.numero_documento ? `nº ${d.numero_documento}` : '']
    .filter(Boolean)
    .join(' ');
  const linha = (k, v) => `<p style="margin:0">${k}: ${esc(v || '-')}</p>`;
  return `<html><body style="font-family:'Times New Roman',serif;font-size:12pt">
<h1 style="text-align:center;font-size:18pt;text-decoration:underline">DECLARAÇÃO</h1>
<p>DOS INOCENTES LDA, com sede na PRACETA DAS ARTEMÍSIAS N10 2710-063 SINTRA declara para os devidos efeitos e em especial para fazer fé perante as autoridades de trânsito, que vendeu a ${esc(d.nome)}, ${esc(doc)}${d.morada ? ` com morada em ${esc(d.morada)}` : ''}, a viatura com as seguintes características:</p>
<br/>
${linha('Matricula', d.matricula)}
${linha('Categoria', d.categoria || 'Ligeiro Passageiros')}
${linha('Estado', d.estado || 'USADO')}
${linha('Ano', d.ano)}
${linha('Marca', d.marca)}
${linha('Combustível', d.combustivel)}
${linha('Modelo', d.modelo)}
${linha('Cor', d.cor)}
${linha('Cilindrada', d.cilindrada)}
${linha('Lotação', d.lotacao)}
${linha('Chassis', d.chassis)}
<br/>
<p>Cuja documentação se encontra em fase de regularização junto das Repartições Oficiais. Nota autorizada pela Direção Geral das Contribuições e Impostos, por despacho do Exmo. Sr. Secretário de Estado do Orçamento.<br/><u>Este documento é válido num período máximo de 60 dias.</u></p>
<br/><br/>
<p>CHELEIROS, ${esc(data)}<br/>A Gerência,</p>
<br/><br/>
<p>___________________</p>
</body></html>`;
}

async function criarDoc(folderId, nomeFicheiro, dados) {
  const token = await getAccessToken(DRIVE_WRITE_SCOPE);
  const boundary = `vianta-${Date.now()}`;
  const metadata = { name: nomeFicheiro, parents: [folderId], mimeType: 'application/vnd.google-apps.document' };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n`),
    Buffer.from(htmlDeclaracao(dados), 'utf8'),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) {
    console.error('Drive create doc error:', await res.text());
    throw new Error('Erro ao criar o documento na Drive');
  }
  return res.json();
}

export const handler = async (event) => {
  const origin = resolveOrigin(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(origin), body: '' };
  if (!process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT) {
    return reply(origin, 500, { error: 'GOOGLE_DRIVE_SERVICE_ACCOUNT must be set' });
  }

  try {
    if (event.httpMethod === 'GET') {
      const token = await getAccessToken();
      const root = await findPedidosFolder(token);
      if (!root) return reply(origin, 404, { error: 'Pasta "Pedidos Financiamento" não encontrada (partilhar com a service account)' });
      const subs = await driveList(
        token,
        `'${root.id}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
        'files(id,name)',
      );
      return reply(origin, 200, { clientes: subs.files || [] });
    }

    if (event.httpMethod !== 'POST') return reply(origin, 405, { error: 'Method not allowed' });
    const b = JSON.parse(event.body || '{}');
    if (!b.folderId) return reply(origin, 400, { error: 'folderId required' });

    if (b.action === 'cliente' || b.action === 'carro') {
      const token = await getAccessToken();
      return reply(origin, 200, await extrair(token, b.folderId, b.action));
    }
    if (b.action === 'criar') {
      if (!b.dados || !b.dados.nome) return reply(origin, 400, { error: 'dados.nome required' });
      const file = await criarDoc(b.folderId, b.nome || 'Declaração de Circulação', b.dados);
      return reply(origin, 200, { file });
    }
    return reply(origin, 400, { error: 'action inválida' });
  } catch (e) {
    console.error('declaracao error:', e);
    return reply(origin, e.status || 500, { error: e.status === 501 ? e.message : 'Erro ao processar a declaração' });
  }
};
