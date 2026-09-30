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
import {
  useCarros,
  useCentralWrites,
  useInvestidores,
  errorMessage,
} from '@/hooks/useOperacoes';
import { DeleteConfirm, Field } from './shared';

const EMPTY = { nome: '', email: '', telefone: '', iban: '', nif: '' };

/** Criar / editar / eliminar investidor. `id` indefinido = novo. */
export function InvestidorDialog({
  open,
  id,
  onOpenChange,
}: {
  open: boolean;
  id?: number;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { data: investidores = [] } = useInvestidores();
  const { data: carros = [] } = useCarros();
  const { create, remove, reload } = useCentralWrites('investidores');
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    const inv = id ? investidores.find((i) => i.id === id) : undefined;
    setForm(
      inv
        ? {
            nome: inv.nome || '',
            email: inv.email || '',
            telefone: inv.telefone || '',
            iban: inv.iban || '',
            nif: inv.nif || '',
          }
        : EMPTY,
    );
    // Só reinicia o formulário ao abrir (não a cada refetch da lista).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        nome: form.nome || null,
        email: form.email || null,
        telefone: form.telefone || null,
        iban: form.iban || null,
        nif: form.nif || null,
      };
      if (id) {
        for (const field of ['nome', 'email', 'telefone', 'iban', 'nif'] as const) {
          await updateCentralField('investidores', id, field, body[field]);
        }
        await reload();
      } else {
        await create.mutateAsync(body);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(`Erro ao guardar: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    const numCarros = carros.filter((v) => v.investidor_id === id).length;
    if (numCarros > 0) {
      toast.error(
        `Não é possível eliminar: há ${numCarros} viatura(s) associada(s) a este investidor. Mude o proprietário dessas viaturas primeiro.`,
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
          <DialogTitle>{id ? 'Editar Investidor' : 'Novo Investidor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome" required className="col-span-2">
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
            <Field label="IBAN">
              <Input value={form.iban} onChange={(e) => set('iban', e.target.value)} />
            </Field>
            <Field label="NIF">
              <Input value={form.nif} onChange={(e) => set('nif', e.target.value)} />
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
