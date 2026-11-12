import type { Carro } from '@/lib/operacoes/types';
import { nomeCarroPartes } from '@/lib/operacoes/identidadeViatura';
import { cn } from '@/lib/utils';

type Identidade = Pick<Carro, 'marca' | 'marca_modelo' | 'versao'>;

/** Apresentação canónica: Marca Modelo, com a versão mais pequena e fina. */
export function NomeViatura({
  carro,
  className,
  fallback = '—',
}: {
  carro: Identidade | null | undefined;
  className?: string;
  fallback?: string;
}) {
  if (!carro) return <span className={className}>{fallback}</span>;
  const { marca, modelo, versao } = nomeCarroPartes(carro);
  const nome = [marca, modelo].filter(Boolean).join(' ') || fallback;

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-1', className)}>
      <span>{nome}</span>
      {versao && <span className="text-[0.8em] font-light text-muted-foreground">{versao}</span>}
    </span>
  );
}
