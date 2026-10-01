import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { updateCentralField } from '@/lib/operacoes/central';
import { useCarros, useCentralWrites, useClientes, errorMessage } from '@/hooks/useOperacoes';
import { DeleteConfirm, Field } from './shared';

const EMPTY = { nome: '', email: '', telefone: '' };

/** Criar / editar / eliminar cliente (comprador). `id` indefinido = novo. */
export function ClienteDialog({
  open,
  id,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  id?: number;
  onOpenChange: (open: boolean) => void;
  /** Chamado com o id do cliente acabado de criar (para o selecionar na viatura). */
  onSaved?: (newId: number | null) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { data: clientes = [] } = useClientes();
  const { data: carros = [] } = useCarros();
  const { create, remove, reload } = useCentralWrites('clientes');
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    const c = id ? clientes.find((x) => x.id === id) : undefined;
    setForm(
      c ? { nome: c.nome || '', email: c.email || '', telefone: c.telefone || '' } : EMPTY,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    try {
      const body = {
        nome: form.nome || null,
        email: form.email || null,
        telefone: form.telefone || null,
      };
      let newId: number | null = null;
      if (id) {
        for (const field of ['nome', 'email', 'telefone'] as const) {
          await updateCentralField('clientes', id, field, body[field]);
        }
        await reload();
      } else {
        const rows = await create.mutateAsync(body);
        newId = rows[0]?.id ?? null;
      }
      onOpenChange(false);
      onSaved?.(newId);
    } catch (err) {
      toast.error(`Erro ao guardar: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    const numCarros = carros.filter((v) => v.cliente_id === id).length;
    if (numCarros > 0) {
      toast.error(
        `Não é possível eliminar: há ${numCarros} viatura(s) associada(s) a este cliente.`,
      );
      return;
    }
    try {
      await remove.mutateAsync(id);
      onOpenChange(false);
    } catch (err) {
      toast.error(`Erro ao eliminar: ${errorMessage(err)}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{id ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nome" required className="sm:col-span-2">
              <Input required value={form.nome} onChange={(e) => set('nome', e.target.value)} />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Telefone">
              <Input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            {id ? (
              <DeleteConfirm label="Eliminar" busy={remove.isPending} onConfirm={onDelete} />
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Guardar
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
