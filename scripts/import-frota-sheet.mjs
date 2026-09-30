#!/usr/bin/env node
// Importa a sheet "Frota de Viaturas" para a tabela `carros` (Supabase), via API central.
//
//   node scripts/import-frota-sheet.mjs            -> pré-visualização (não escreve nada)
//   node scripts/import-frota-sheet.mjs --apply    -> aplica
//
// Regras: liga sheet e base de dados pela matrícula; só PREENCHE campos que estão
// vazios na base de dados (nunca sobrepõe); diferenças entre valores já preenchidos
// são apenas listadas como conflitos. Valores corrompidos da sheet (números que o
// Google Sheets converteu em datas, texto de modelo "Mensal: € | %:") são ignorados.

const SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/1j5RCxSjd24QlPaquRX7C7eeiHrzPo1c6Wsb0OQWFRjQ/export?format=csv';
const API = process.env.CENTRAL_API || 'https://vianta-dashboard.netlify.app/.netlify/functions/central';
const APPLY = process.argv.includes('--apply');
// Por defeito só viaturas em stock no ERP (as mesmas da página Stock); --all para todas.
const ALL = process.argv.includes('--all');
const STOCK_ESTADOS = ['Para Venda', 'Para Aluguer', 'Em Preparação', 'Manutenção'];

// cabeçalho da sheet (normalizado) -> coluna da base de dados
const MAP = {
  'marca/modelo': 'marca_modelo',
  versao: 'versao',
  ano: 'ano',
  combustivel: 'combustivel',
  'kms atuais': 'kms_atuais',
  cor: 'cor',
  caixa: 'caixa',
  'autonomia (km)': 'autonomia_km',
  'categorias tvde': 'categorias_tvde',
  proprietario: 'proprietario',
  'tipo gestao': 'tipo_gestao',
  estado: 'estado',
  'preco venda (€)': 'preco_venda',
  'valor aluguer (semanal)': 'valor_aluguer_semanal',
  'caucao (€)': 'caucao',
  'motorista atual': 'motorista_atual',
  garantia: 'garantia',
  'fim elegib. tvde': 'fim_elegibilidade_tvde',
  'docs (link)': 'docs_link',
  'fotos (link)': 'fotos_link',
  obs: 'obs',
};
// marca_modelo já existe sempre na BD; não é preciso preencher, mas serve para relatório.
const MONEY = new Set(['preco_venda', 'valor_aluguer_semanal', 'caucao']);

const norm = (s) =>
  String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const plate = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const empty = (v) => v == null || String(v).trim() === '';

function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

// Devolve o valor limpo ou null se for lixo.
function clean(field, raw) {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  if (/^Mensal:/i.test(v)) return null;
  // Google Sheets converteu números em datas (ex.: "1902/03/09", "12/04/1949").
  if (MONEY.has(field) && (/^\d{4}\/\d{2}\/\d{2}$/.test(v) || /^\d{2}\/\d{2}\/\d{4}$/.test(v))) return null;
  return v;
}

const same = (a, b) => norm(a).replace(/\s+/g, '') === norm(b).replace(/\s+/g, '');

async function main() {
  const [csvRes, dbRes] = await Promise.all([fetch(SHEET_CSV), fetch(`${API}?type=carros`)]);
  if (!csvRes.ok) throw new Error(`Sheet: HTTP ${csvRes.status}`);
  if (!dbRes.ok) throw new Error(`API: HTTP ${dbRes.status}`);
  const rows = parseCsv(await csvRes.text());
  const headers = rows[0].map(norm);
  const iPlate = headers.indexOf('matricula');
  const col = Object.fromEntries(
    Object.entries(MAP).map(([h, f]) => [f, headers.indexOf(norm(h))]),
  );
  const missing = Object.entries(col).filter(([, i]) => i < 0).map(([f]) => f);
  if (iPlate < 0) throw new Error('Coluna Matrícula não encontrada na sheet');
  if (missing.length) console.log('Aviso: colunas não encontradas na sheet:', missing.join(', '), '\n');

  const db = await dbRes.json();
  const byPlate = new Map(db.filter((c) => c.matricula && (ALL || STOCK_ESTADOS.includes(c.estado))).map((c) => [plate(c.matricula), c]));

  const fills = []; // {id, matricula, field, value}
  const conflicts = [];
  const ignored = [];
  const notInDb = [];
  const seen = new Set();

  for (const r of rows.slice(1)) {
    const mat = plate(r[iPlate]);
    if (!mat) continue;
    const car = byPlate.get(mat);
    if (!car) { if (ALL) notInDb.push(`${r[iPlate]} (${r[col.marca_modelo] || '?'})`); continue; }
    seen.add(car.id);
    for (const [field, i] of Object.entries(col)) {
      if (i < 0 || field === 'marca_modelo') continue;
      const raw = r[i];
      const value = clean(field, raw);
      if (value == null) {
        if (!empty(raw)) ignored.push(`${car.matricula} · ${field}: "${String(raw).trim()}"`);
        continue;
      }
      if (empty(car[field])) fills.push({ id: car.id, matricula: car.matricula, field, value });
      else if (!same(car[field], value))
        conflicts.push(`${car.matricula} · ${field}: BD="${car[field]}" | sheet="${value}"`);
    }
  }

  const porCampo = {};
  fills.forEach((f) => (porCampo[f.field] = (porCampo[f.field] || 0) + 1));
  const carrosTocados = new Set(fills.map((f) => f.id)).size;

  console.log(`Sheet: ${rows.length - 1} linhas · BD: ${db.length} carros · ligados por matrícula: ${seen.size}`);
  console.log(`A preencher: ${fills.length} campos em ${carrosTocados} viaturas`);
  console.log(porCampo);
  console.log(`\nConflitos (BD já tem valor diferente; NÃO alterados): ${conflicts.length}`);
  conflicts.forEach((c) => console.log('  ', c));
  console.log(`\nValores da sheet ignorados por estarem corrompidos: ${ignored.length}`);
  ignored.forEach((c) => console.log('  ', c));
  console.log(`\nNa sheet mas sem correspondência na BD: ${notInDb.length}`);
  notInDb.forEach((c) => console.log('  ', c));

  if (!APPLY) {
    console.log('\n(pré-visualização — nada foi escrito. Use --apply para aplicar.)');
    return;
  }
  let ok = 0, fail = 0;
  for (const f of fills) {
    const r = await fetch(`${API}?type=carros`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id, field: f.field, value: f.value }),
    });
    if (r.ok) ok++;
    else { fail++; console.log('FALHOU', f.matricula, f.field, r.status); }
  }
  console.log(`\nAplicado: ${ok} campos OK, ${fail} falhas.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
