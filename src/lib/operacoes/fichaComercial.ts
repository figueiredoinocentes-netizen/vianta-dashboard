// Geração da Ficha Comercial imprimível (A4) — abre pop-up e imprime.
// Layout pensado para meter no carro: o comercial leva o papel nas visitas.

import type { Carro } from './types';

const vazio = (v: unknown) => v == null || String(v).trim() === '';
const txt = (v: unknown) => (vazio(v) ? '—' : String(v));

function linha(label: string, valor: unknown): string {
  return `<tr><td class="rotulo">${label}</td><td class="valor">${txt(valor)}</td></tr>`;
}

function secao(titulo: string, body: string): string {
  return `<div class="secao">
    <h2 class="secao-titulo">${titulo}</h2>
    <table class="tabela">${body}</table>
  </div>`;
}

export function gerarFichaComercialHTML(carro: Carro): string {
  const v = carro;
  const isVenda = v.tipo_gestao === 'Venda';

  const modelo = v.marca_modelo || '';
  const title = [modelo, v.versao].filter(Boolean).join(' ');
  const subtitulo = [v.matricula, v.ano, v.combustivel, v.kms_atuais ? `${v.kms_atuais} km` : null]
    .filter(Boolean).join(' · ');

  // Preço
  let precoHtml: string;
  if (isVenda) {
    precoHtml = `<div class="preco">${txt(v.preco_venda)} €</div>`;
    const credLinhas = [
      ['120 meses (10 anos)', v.credito_120_meses],
      ['60 meses (5 anos)', v.credito_60_meses],
      ['48 meses (4 anos)', v.credito_48_meses],
    ].filter(([, x]) => !vazio(x));
    if (credLinhas.length) {
      precoHtml += '<div class="credito">Crédito desde ' +
        credLinhas.map(([l, x]) => `${x}€/mês (${l})`).join(' · ') +
        '</div>';
    }
  } else {
    precoHtml = `<div class="preco aluguer">${txt(v.valor_aluguer_semanal)} € / semana</div>`;
    if (!vazio(v.caucao)) precoHtml += `<div class="credito">Caução: ${v.caucao} €</div>`;
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
  .topo .marca { font-weight: 700; font-size: 13pt; color: #1a4f8a;
    letter-spacing: 1px; }
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
    <span class="marca">VIANTA</span>
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