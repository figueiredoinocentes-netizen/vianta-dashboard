// Geração da Ficha Comercial imprimível (A4) — abre pop-up e imprime.
// Layout pensado para meter no carro: o comercial leva o papel nas visitas.

import type { Carro } from './types';

const vazio = (v: unknown) => v == null || String(v).trim() === '';
const txt = (v: unknown) => (vazio(v) ? '—' : String(v));

/** Formata número com pontos nos milhares: 23000 → "23.000" */
function fmtNum(v: unknown): string {
  if (vazio(v)) return '—';
  const s = String(v).replace(/[^\d.,]/g, '').replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return String(v);
  return n.toLocaleString('pt-PT', { maximumFractionDigits: 0 });
}

function linha(label: string, valor: unknown): string {
  return `<tr><td class="rotulo">${label}</td><td class="valor">${txt(valor)}</td></tr>`;
}

function secao(titulo: string, body: string): string {
  return `<div class="secao">
    <h2 class="secao-titulo">${titulo}</h2>
    <table class="tabela">${body}</table>
  </div>`;
}

const logoB64 = 'data:image/png;base64,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';

export function gerarFichaComercialHTML(carro: Carro): string {
  const v = carro;
  const isVenda = v.tipo_gestao === 'Venda';

  const modelo = v.marca_modelo || '';
  const title = [modelo, v.versao].filter(Boolean).join(' ');
  const subtitulo = [v.matricula, v.ano, v.combustivel, v.kms_atuais ? `${fmtNum(v.kms_atuais)} km` : null]
    .filter(Boolean).join(' · ');

  // Preço
  let precoHtml: string;
  if (isVenda) {
    precoHtml = `<div class="preco">${fmtNum(v.preco_venda)} €</div>`;
    const credLinhas = [
      ['120 meses (10 anos)', v.credito_120_meses],
      ['60 meses (5 anos)', v.credito_60_meses],
      ['48 meses (4 anos)', v.credito_48_meses],
    ].filter(([, x]) => !vazio(x));
    if (credLinhas.length) {
      precoHtml += '<div class="credito">Crédito desde ' +
        credLinhas.map(([l, x]) => `${fmtNum(x)}€/mês (${l})`).join(' · ') +
        '</div>';
    }
  } else {
    precoHtml = `<div class="preco aluguer">${fmtNum(v.valor_aluguer_semanal)} € / semana</div>`;
    if (!vazio(v.caucao)) precoHtml += `<div class="credito">Caução: ${fmtNum(v.caucao)} €</div>`;
  }

  // Foto
  const fotoHtml = v.foto_url
    ? `<img src="${v.foto_url}" alt="" class="foto" />`
    : '<div class="sem-foto">Sem foto disponível</div>';

  // Especificações
  const specs =
    linha('Marca / Modelo', v.marca_modelo) +
    linha('Versão', v.versao) +
    linha('Matrícula', v.matricula) +
    linha('Ano', v.ano) +
    linha('Combustível', v.combustivel) +
    linha('Quilómetros', v.kms_atuais ? `${v.kms_atuais} km` : '—') +
    linha('Potência', v.cavalos ? `${v.cavalos} cv` : '—') +
    linha('Caixa', v.caixa) +
    linha('Cor', v.cor) +
    linha('Garantia viatura', v.garantia_viatura) +
    linha('Garantia bateria', v.garantia_bateria) +
    linha('Volume bagageira', v.volume_bagageira ? `${v.volume_bagageira} L` : '—');

  const tvde =
    linha('Categorias TVDE', v.categorias_tvde) +
    linha('Fim elegibilidade TVDE', v.fim_elegibilidade_tvde);

  const obsHtml = v.obs ? `<div class="obs">${v.obs}</div>` : '';

  const timestamp = new Date().toLocaleDateString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ficha Comercial — ${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 10mm 12mm; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif;
    font-size: 11pt; color: #1a1a1a; background: #fff; line-height: 1.5;
  }
  .pagina { max-width: 190mm; margin: 0 auto; }

  .topo { display: flex; justify-content: space-between; align-items: center;
    border-bottom: 2px solid #1a4f8a; padding-bottom: 4pt; margin-bottom: 8pt; }
  .topo .marca img { height: 36px; display: block; }
  .topo .meta { font-size: 8pt; color: #888; }

  h1 { font-size: 14pt; color: #1a4f8a; margin-bottom: 2pt; }
  .subtitulo { font-size: 9pt; color: #666; margin-bottom: 6pt; }

  .cabecalho-viatura { display: flex; gap: 6pt; margin-bottom: 8pt; align-items: flex-start; }
  .foto { width: 65mm; height: 65mm; object-fit: cover; border: 1px solid #ddd;
    border-radius: 4px; flex-shrink: 0; }
  .sem-foto { width: 65mm; height: 65mm; display: flex; align-items: center;
    justify-content: center; background: #f5f5f5; border: 1px solid #ddd;
    border-radius: 4px; color: #999; font-size: 10pt; flex-shrink: 0; }
  .info-preco { flex: 1; min-width: 0; }
  .preco { font-size: 16pt; font-weight: 700; color: #c0392b; margin-bottom: 3pt; }
  .preco.aluguer { font-size: 14pt; color: #1a4f8a; }
  .credito { font-size: 10pt; color: #555; line-height: 1.6; }

  .secao { margin-bottom: 5pt; break-inside: avoid; }
  .secao-titulo { font-size: 10pt; font-weight: 700; text-transform: uppercase;
    color: #1a4f8a; border-bottom: 1px solid #ccc; padding-bottom: 2pt;
    margin-bottom: 2pt; }
  .tabela { width: 100%; border-collapse: collapse; }
  .tabela td { padding: 2pt 8pt 2pt 2pt; font-size: 10pt; border-bottom: 1px solid #eee; }
  td.rotulo { font-weight: 600; color: #555; width: 40%; font-size: 9pt; }
  td.valor { font-weight: 600; color: #1a1a1a; }

  .obs { margin-top: 4pt; padding: 4pt 6pt; background: #f9f9f9;
    border-radius: 4px; font-size: 10pt; color: #555; }

  .rodape { margin-top: 10pt; text-align: center; font-size: 8pt; color: #aaa;
    border-top: 1px solid #eee; padding-top: 4pt; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .secao { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="pagina">
  <div class="topo">
    <span class="marca"><img src="${logoB64}" alt="VIANTA" /></span>
    <span class="meta">Ficha Comercial · ${timestamp}</span>
  </div>

  <h1>${title}</h1>
  <div class="subtitulo">${subtitulo}</div>

  <div class="cabecalho-viatura">
    ${fotoHtml}
    <div class="info-preco">${precoHtml}</div>
  </div>

  ${secao('Características', specs)}
  ${(v.categorias_tvde || v.fim_elegibilidade_tvde) ? secao('TVDE', tvde) : ''}

  ${obsHtml}

  <div class="rodape">
    Vianta — Dos Inocentes, Lda · Ficha Comercial · ${timestamp}
  </div>
</div>
</body>
</html>`;
}

export function imprimirFichaComercial(carro: Carro): void {
  const html = gerarFichaComercialHTML(carro);
  const w = window.open('', '_blank', 'width=800,height=1000,scrollbars=yes');
  if (!w) { alert('Permita pop-ups para imprimir a ficha comercial.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 800);
}