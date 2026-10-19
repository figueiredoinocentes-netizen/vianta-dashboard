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

const logoB64 = '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';

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