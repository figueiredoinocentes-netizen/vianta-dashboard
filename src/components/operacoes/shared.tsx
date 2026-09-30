import { useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { RefreshCw, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BADGE_CLASS, STATUSES } from '@/lib/operacoes/constants';
import type { Carro } from '@/lib/operacoes/types';
import { useRefreshOperacoes, useUpdateCarroField } from '@/hooks/useOperacoes';
import { useOps } from './OpsContext';

export function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}

export const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(selectClass, className)} {...props} />;
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
      <div className="mb-3 text-3xl opacity-50">{icon}</div>
      <div>{text}</div>
    </div>
  );
}

export function ErrorBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-destructive">
      {text}
    </div>
  );
}

/** Botão + caixa de confirmação: só elimina depois de escrever DELETE. */
export function DeleteConfirm({
  label,
  busy,
  onConfirm,
}: {
  label: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          setOpen((o) => !o);
          setText('');
        }}
      >
        {label}
      </Button>
      {open && (
        <div className="order-last mt-3 w-full basis-full rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="mb-2 text-xs text-red-300">
            Esta ação não pode ser desfeita. Escreva <strong>DELETE</strong> para confirmar.
          </p>
          <div className="flex gap-2">
            <Input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="DELETE"
            />
            <Button
              type="button"
              variant="destructive"
              disabled={text.trim() !== 'DELETE' || busy}
              onClick={onConfirm}
            >
              {busy ? 'A eliminar...' : 'Eliminar definitivamente'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Estado da viatura: sempre um <select> real, com a cor do estado. */
export function StatusSelect({ carro }: { carro: Carro }) {
  const update = useUpdateCarroField();
  return (
    <select
      value={carro.estado || ''}
      title="Alterar estado"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => update(carro, 'estado', e.target.value)}
      className={cn(
        'cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium outline-none transition hover:brightness-125',
        BADGE_CLASS[carro.estado || ''] || 'bg-muted text-muted-foreground',
      )}
    >
      {!carro.estado && <option value="">—</option>}
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-card text-foreground">
          {s}
        </option>
      ))}
    </select>
  );
}

export function StatusBadge({ estado }: { estado: string | null }) {
  return (
    <span
      className={cn(
        'inline-block rounded px-2 py-0.5 text-[11px] font-medium',
        BADGE_CLASS[estado || ''] || 'bg-muted text-muted-foreground',
      )}
    >
      {estado}
    </span>
  );
}

/** Cabeçalho de cada secção: título, contagem, atualizar, botão de novo e pesquisa. */
export function OpsHeader({
  title,
  count,
  newLabel,
  onNew,
  showSearch = true,
}: {
  title: string;
  count: number;
  newLabel: string;
  onNew: () => void;
  showSearch?: boolean;
}) {
  const { search, setSearch } = useOps();
  const refresh = useRefreshOperacoes();
  return (
    <div className="mb-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Gestão de Frota</h1>
          <p className="text-sm text-muted-foreground">
            {title} • {count} registos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>
            <RefreshCw /> Atualizar
          </Button>
          <Button onClick={onNew}>
            <Plus /> {newLabel}
          </Button>
        </div>
      </div>
      {showSearch && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por matrícula, modelo, motorista, investidor, armazém…"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar pesquisa"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
