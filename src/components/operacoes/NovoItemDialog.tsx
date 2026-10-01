import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CATEGORIAS_ARMAZEM } from '@/lib/operacoes/constants';
import { useCentralWrites, errorMessage } from '@/hooks/useOperacoes';
import { Field, NativeSelect } from './shared';

const EMPTY = {
  item: '',
  categoria: 'Lubrificantes',
  stock: '',
  minimo: '',
  unidade: '',
  fornecedor: '',
};

export function NovoItemDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { create } = useCentralWrites('armazem');
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await create.mutateAsync({
        item: form.item || null,
        categoria: form.categoria || null,
        stock_atual: form.stock ? Number(form.stock) : 0,
        stock_minimo: form.minimo ? Number(form.minimo) : 0,
        unidade: form.unidade || null,
        fornecedor: form.fornecedor || null,
      });
      setForm(EMPTY);
      onOpenChange(false);
    } catch (err) {
      toast.error(`Erro ao guardar: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Novo Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Item" required className="sm:col-span-2">
              <Input required value={form.item} onChange={(e) => set('item', e.target.value)} />
            </Field>
            <Field label="Categoria">
              <NativeSelect
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
              >
                {CATEGORIAS_ARMAZEM.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Stock Atual">
              <Input
                type="number"
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
              />
            </Field>
            <Field label="Stock Mínimo">
              <Input
                type="number"
                value={form.minimo}
                onChange={(e) => set('minimo', e.target.value)}
              />
            </Field>
            <Field label="Unidade">
              <Input value={form.unidade} onChange={(e) => set('unidade', e.target.value)} />
            </Field>
            <Field label="Fornecedor" className="sm:col-span-2">
              <Input
                value={form.fornecedor}
                onChange={(e) => set('fornecedor', e.target.value)}
              />
            </Field>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
