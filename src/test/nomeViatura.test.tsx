import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NomeViatura } from '@/components/operacoes/NomeViatura';

describe('NomeViatura', () => {
  it('apresenta marca e modelo em destaque e versão mais pequena e fina', () => {
    const html = renderToStaticMarkup(
      <NomeViatura carro={{ marca: 'VW', marca_modelo: 'ID.5', versao: 'Pro' }} />,
    );
    expect(html).toContain('VW ID.5');
    expect(html).toContain('text-[0.8em] font-light');
    expect(html).toContain('>Pro</span>');
  });

  it('mantém valores legados de marca/modelo reconhecidos', () => {
    const html = renderToStaticMarkup(
      <NomeViatura carro={{ marca: null, marca_modelo: 'BYD ATTO 3', versao: null }} />,
    );
    expect(html).toContain('BYD ATTO 3');
  });
});
