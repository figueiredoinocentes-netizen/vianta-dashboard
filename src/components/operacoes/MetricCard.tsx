import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Carro } from '@/lib/operacoes/types';
import { useOps } from './OpsContext';
import { StatusBadge } from './shared';

/**
 * Card de métrica da Visão Geral. Regra geral: todos são clicáveis.
 * - `to`: já existe uma aba da plataforma com este conteúdo → navega para lá.
 * - `detail`: não existe aba → abre um pop-up com o detalhe (recebe `close` para fechar ao navegar).
 */
export function MetricCard({
  icon,
  color,
  value,
  label,
  sub,
  to,
  detail,
  compact,
}: {
  icon?: string;
  color?: string;
  value: ReactNode;
  label: string;
  sub?: string;
  to?: string;
  detail?: { title: string; render: (close: () => void) => ReactNode };
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const onClick = () => {
    if (to) navigate(to);
    else if (detail) setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'rounded-xl border border-border bg-card text-left transition hover:-translate-y-px hover:border-primary',
          compact ? 'p-4' : 'flex items-start gap-3 p-4',
        )}
      >
        {!compact && icon && (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
            style={{ background: `${color}26`, color }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {compact ? (
            <>
              <div className="mb-1 text-xs text-muted-foreground">{label}</div>
              <div className="font-display text-2xl font-bold">{value}</div>
            </>
          ) : (
            <>
              <div className="font-display text-2xl font-bold leading-tight" style={{ color }}>
                {value}
              </div>
              <div className="mt-0.5 text-xs font-semibold text-foreground">{label}</div>
              {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
            </>
          )}
          <div className="mt-1 text-[10px] text-primary/80">{to ? 'Abrir aba ↗' : 'Ver detalhe'}</div>
        </div>
      </button>

      {detail && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{detail.title}</DialogTitle>
            </DialogHeader>
            {detail.render(() => setOpen(false))}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** Lista de viaturas clicável (abre a ficha da viatura) para os pop-ups das métricas. */
export function CarList({
  items,
  onPick,
  empty = 'Sem viaturas.',
}: {
  items: { carro: Carro; extra?: string }[];
  onPick: () => void;
  empty?: string;
}) {
  const { openVehicle } = useOps();
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {items.map(({ carro, extra }) => (
        <button
          key={carro.id}
          type="button"
          onClick={() => {
            onPick();
            openVehicle(carro.id);
          }}
          className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs transition hover:border-primary"
        >
          <span className="min-w-0 truncate">
            <span className="font-medium">{carro.matricula}</span> · {carro.marca_modelo}
            {carro.proprietario ? <span className="text-muted-foreground"> · {carro.proprietario}</span> : null}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {extra && <span className="font-semibold">{extra}</span>}
            <StatusBadge estado={carro.estado} />
          </span>
        </button>
      ))}
    </div>
  );
}
