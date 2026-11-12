// Central Vianta API — Netlify Function (CommonJS)
// Wraps Supabase REST API for motoristas, pagamentos, carros, armazem

const TABLE_MAP = {
  motoristas: 'motoristas',
  pagamentos: 'pagamentos',
  carros: 'carros',
  armazem: 'armazem',
  investidores: 'investidores',
  clientes: 'clientes',
  financeiro: 'financeiro',
  ocorrencias: 'ocorrencias',
  sinistros: 'sinistros',
  estados_log: 'carros_estados_log',
};

const PROD_ORIGIN = 'https://vianta-dashboard.netlify.app';
// Matches Netlify branch/deploy-preview subdomains for this same site, e.g.
// dev--vianta-dashboard.netlify.app, deploy-preview-3--vianta-dashboard.netlify.app
const PREVIEW_ORIGIN_RE = /^https:\/\/[a-z0-9-]+--vianta-dashboard\.netlify\.app$/;

function resolveOrigin(event) {
  const origin = (event.headers || {}).origin || (event.headers || {}).Origin;
  if (origin && (origin === PROD_ORIGIN || PREVIEW_ORIGIN_RE.test(origin))) return origin;
  return PROD_ORIGIN;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || PROD_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, apikey',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function ok(data, origin) {
  return { statusCode: 200, headers: cors(origin), body: JSON.stringify(data) };
}

function err(msg, code = 500, origin) {
  return { statusCode: code, headers: cors(origin), body: JSON.stringify({ error: msg }) };
}

// Logs the real Supabase/internal error server-side (Netlify function logs)
// and returns a generic message to the client, so internal details never leak.
async function supaErr(res, context, origin) {
  const text = await res.text();
  console.error(`Supabase error [${context}]:`, text);
  return err('Erro ao aceder à base de dados', res.status, origin);
}

function internalErr(e, context, origin) {
  console.error(`Internal error [${context}]:`, e);
  return err('Erro interno', 500, origin);
}

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

// ── Ficha obrigatória por tipo de gestão ───────────────────────────────────────
// ⚠️ Manter em sincronia com src/lib/operacoes/estadoRequisitos.ts
const TIPO_GESTAO_MISTO = 'Venda e Aluguer';
const ESTADO_MISTO = 'Para Venda e Aluguer';
const ESTADOS_COM_FICHA = ['Para Venda', 'Para Aluguer', ESTADO_MISTO];
const CAMPOS_FICHA_COMUNS = [
  ['cavalos', 'Cavalos (cv)'],
  ['caixa', 'Caixa'],
  ['categorias_tvde', 'Categorias TVDE'],
  ['fotos', 'Fotos da viatura'],
];
const CAMPOS_FICHA_VENDA = [
  ['garantia_viatura', 'Garantia viatura'],
  ['preco_venda', 'Preço de venda'],
];
const CAMPOS_FICHA_ALUGUER = [
  ['valor_aluguer_semanal', 'Valor do aluguer semanal'],
  ['caucao', 'Caução'],
];
const CAMPOS_FICHA_ELETRICO = [
  ['bateria_kwh', 'Bateria (kWh)'],
  ['autonomia_km', 'Autonomia (km)'],
];

const preenchido = (v) => v != null && String(v).trim() !== '';
const eEletrico = (r) =>
  String((r && r.combustivel) || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .includes('eletric');

function ofertasFicha(registo, estado) {
  const tipo = String((registo && registo.tipo_gestao) || '');
  if (tipo === TIPO_GESTAO_MISTO || estado === ESTADO_MISTO) return ['venda', 'aluguer'];
  if (tipo === 'Venda') return ['venda'];
  if (tipo === 'Aluguer') return ['aluguer'];
  if (estado === 'Para Venda') return ['venda'];
  if (estado === 'Para Aluguer') return ['aluguer'];
  return [];
}

/** Etiquetas dos campos da ficha que faltam preencher nesta viatura. */
function camposFichaEmFalta(registo, estado) {
  const ofertas = ofertasFicha(registo, estado);
  let campos = CAMPOS_FICHA_COMUNS.slice();
  if (ofertas.includes('venda')) campos = campos.concat(CAMPOS_FICHA_VENDA);
  if (ofertas.includes('aluguer')) campos = campos.concat(CAMPOS_FICHA_ALUGUER);
  if (eEletrico(registo)) campos = campos.concat(CAMPOS_FICHA_ELETRICO);
  const faltam = campos
    .filter(([campo]) => {
      if (campo === 'fotos') {
        return !(
          (Array.isArray(registo && registo.fotos) && registo.fotos.some(preenchido)) ||
          preenchido(registo && registo.foto_url)
        );
      }
      return !preenchido(registo && registo[campo]);
    })
    .map(([, label]) => label);
  const combustivel = String((registo && registo.combustivel) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (combustivel.includes('hibrid')) {
    if (!preenchido(registo && registo.combustivel_secundario)) faltam.push('Segundo combustível');
    if (registo.plug_in !== true && registo.plug_in !== false) faltam.push('Plug-in (Sim/Não)');
  }
  return faltam;
}

/** Mensagem de erro, ou null quando a viatura pode assumir o estado pedido. */
function erroFichaEmFalta(registo, estado) {
  if (!ESTADOS_COM_FICHA.includes(estado)) return null;
  const faltam = camposFichaEmFalta(registo, estado);
  if (!faltam.length) return null;
  return `Não é possível passar a "${estado}" sem preencher: ${faltam.join(', ')}.`;
}

export const handler = async (event) => {
  const origin = resolveOrigin(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(origin), body: '' };
  }

  const type = (event.queryStringParameters || {}).type;
  const table = TABLE_MAP[type];
  if (!table) {
    return err(`Invalid type. Must be: ${Object.keys(TABLE_MAP).join(', ')}`, 400, origin);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return err('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set', 500, origin);
  }

  const baseUrl = `${supabaseUrl}/rest/v1/${table}`;
  const headers = sbHeaders();

  try {
    if (event.httpMethod === 'GET') {
      const url = `${baseUrl}?select=*`;
      const res = await fetch(url, { headers });
      if (!res.ok) return await supaErr(res, `GET ${table}`, origin);
      const data = await res.json();
      return ok(data, origin);
    }

    if (event.httpMethod === 'POST') {
      if (!event.body) return err('Body required for POST', 400, origin);
      const record = JSON.parse(event.body);
      if (table === 'carros') {
        for (const r of Array.isArray(record) ? record : [record]) {
          const erro = erroFichaEmFalta(r, r && r.estado);
          if (erro) return err(erro, 422, origin);
        }
      }
      const res = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(record) });
      if (!res.ok) return await supaErr(res, `POST ${table}`, origin);
      const data = await res.json();
      return ok(data, origin);
    }

    if (event.httpMethod === 'PUT') {
      if (!event.body) return err('Body required for PUT', 400, origin);
      const { id, field, value } = JSON.parse(event.body);
      if (!id || !field) return err('PUT body must include id and field', 400, origin);
      const url = `${baseUrl}?id=eq.${encodeURIComponent(id)}`;
      // Passar a viatura a disponível exige a ficha completa: valida-se contra a
      // linha atual na base de dados, não apenas contra o que o frontend enviou.
      if (table === 'carros' && field === 'estado' && ESTADOS_COM_FICHA.includes(value)) {
        const atual = await fetch(`${url}&select=*`, { headers });
        if (!atual.ok) return await supaErr(atual, `GET ${table} (validar estado)`, origin);
        const [registo] = await atual.json();
        const erro = erroFichaEmFalta(registo, value);
        if (erro) return err(erro, 422, origin);
      }
      const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ [field]: value }) });
      if (!res.ok) return await supaErr(res, `PUT ${table}`, origin);
      return ok({ updated: true }, origin);
    }

    if (event.httpMethod === 'DELETE') {
      const id = (event.queryStringParameters || {}).id;
      if (!id) return err('DELETE requires ?id=', 400, origin);
      const url = `${baseUrl}?id=eq.${encodeURIComponent(id)}`;
      const res = await fetch(url, { method: 'DELETE', headers });
      if (!res.ok) return await supaErr(res, `DELETE ${table}`, origin);
      return ok({ deleted: true }, origin);
    }

    return err('Method not allowed', 405, origin);
  } catch (e) {
    return internalErr(e, `${event.httpMethod} ${table}`, origin);
  }
};