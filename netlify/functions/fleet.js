import { google } from 'googleapis';

const SHEET_ID = '1j5RCxSjd24QlPaquRX7C7eeiHrzPo1c6Wsb0OQWFRjQ';
const SHEET_NAME = 'CARROS';

const COLUMNS = {
  '#': 'A', Chave: 'B', Matrícula: 'C', 'Marca/Modelo': 'D', Versão: 'E', Ano: 'F',
  Combustível: 'G', 'KMs Atuais': 'H', Cor: 'I', Caixa: 'J', 'Autonomia (km)': 'K',
  'Categorias TVDE': 'L', Proprietário: 'M', 'Tipo Gestão': 'N', Estado: 'O',
  'Data Entrada': 'P', 'Data Saída': 'Q', 'Custo Aquisição (c/IVA)': 'R',
  'Custo Aquisição (s/IVA)': 'S', 'Despesas (€)': 'T', 'Preço Venda (€)': 'U',
  'Valor Aluguer (semanal)': 'V', 'Caução (€)': 'W', 'Margem Realizada (€)': 'X',
  'Motorista Atual': 'Y', Garantia: 'Z',
};

const VALUES_COLUMNS = ['Ano', 'KMs Atuais', 'Custo Aquisição (c/IVA)', 'Custo Aquisição (s/IVA)', 'Despesas (€)', 'Preço Venda (€)', 'Valor Aluguer (semanal)', 'Caução (€)', 'Margem Realizada (€)'];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT env var not set');
  const creds = JSON.parse(raw);
  return new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Content-Type': 'application/json',
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' };
  }

  try {
    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const { id, column, value, row } = body;

      let targetRow = row;

      if (!targetRow && id) {
        const auth = getAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `${SHEET_NAME}!A:A`,
        });
        const rows = res.data.values || [];
        const found = rows.findIndex(r => String(r[0]) === String(id));
        if (found === -1) return { statusCode: 404, headers: cors(), body: JSON.stringify({ error: 'Vehicle not found' }) };
        targetRow = found + 1;
      }

      const colLetter = COLUMNS[column];
      if (!colLetter) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: `Unknown column: ${column}` }) };

      let finalValue = value;
      const isNumeric = VALUES_COLUMNS.includes(column);
      if (isNumeric && value !== '' && value !== null) {
        finalValue = String(value).replace(/[^\d.,-]/g, '');
      }

      const auth = getAuth();
      const sheets = google.sheets({ version: 'v4', auth });

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!${colLetter}${targetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[finalValue]] },
      });

      return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, row: targetRow }) };
    }

    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: e.message }) };
  }
};