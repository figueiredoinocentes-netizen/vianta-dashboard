import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DateField } from '@/components/operacoes/DateField';
import { DeleteConfirm, Field, NativeSelect } from '@/components/operacoes/shared';
import { updateCentralField } from '@/lib/operacoes/central';
import { eur, toNum } from '@/lib/operacoes/custos';
import type { Carro, Movimento } from '@/lib/operacoes/types';
import { CENTROS_CUSTO } from '@/lib/financeiro';
import { errorMessage, useCentralWrites } from '@/hooks/useOperacoes';

const hoje = () => new Date().toISOString().slice(0, 10);
const abs = (x: unknown) => (x == null || x === '' ? '' : String(Math.abs(toNum(x))).replace('.', ','));
const round2 = (n: number) => Math.round(n * 100) / 100;

type Form = {
  n_documento: string;
  data: string;
  descricao: string;
  semIva: string;
  iva: string;
  centro_custo: string;
  categoria: string;
  contraparte: string;
  carro_id: string;
};

function formDe(m?: Movimento | null): Form {
  return {
    n_documento: m?.n_documento || '',
    data: m?.data || hoje(),
    descricao: m?.descricao || '',
    semIva: abs(m?.valor_sem_iva),
    iva: abs(m?.iva),
    centro_custo: m?.centro_custo || '',
    categoria: m?.categoria || '',
    contraparte: m?.contraparte || '',
    carro_id: m?.carro_id != null ? String(m.carro_id) : '',
  };
}

/** Registo / edição de uma fatura de custo. `mov` = null → nova fatura. */
export function FaturaDialog({
  open,
  mov,
  carros,
  naturezas,
  onOpenChange,
}: {
  open: boolean;
  mov: Movimento | null;
  carros: Carro[];
  naturezas: string[];
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { create, remove } = useCentralWrites('financeiro');
  const [form, setForm] = useState<Form>(formDe(mov));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) setForm(formDe(mov));
  }, [open, mov]);

  // Linhas antigas só com o total c/ IVA registado.
  const soTotal = !!mov && (mov.valor_sem_iva == null || mov.valor_sem_iva === '') && toNum(mov.valor) !== 0;
  const s = form.semIva.trim() ? Math.abs(toNum(form.semIva)) : null;
  const i = form.iva.trim()
    ? Math.abs(toNum(form.iva))
    : s != null && soTotal
      ? round2(Math.abs(toNum(mov!.valor)) - s) // IVA = total já registado − valor s/ IVA
      : null;
  const total = s != null ? round2(s + (i ?? 0)) : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mov && s == null) return toast.error('Indique o valor s/ IVA.');
    if (!form.centro_custo) return toast.error('Escolha o centro de custo.');
    if (!form.categoria.trim()) return toast.error('Indique a natureza do custo.');

    const campos: Record<string, unknown> = {
      n_documento: form.n_documento.trim() || null,
      data: form.data || null,
      descricao: form.descricao.trim() || null,
      centro_custo: form.centro_custo,
      categoria: form.categoria.trim(),
      contraparte: form.contraparte.trim() || null,
      carro_id: form.carro_id ? Number(form.carro_id) : null,
    };
    if (s != null) {
      campos.valor_sem_iva = -s;
      campos.iva = i == null ? null : -round2(i);
      campos.valor = -(total ?? s);
    }

    setSaving(true);
    try {
      if (!mov) {
        await create.mutateAsync({ tipo: 'Custo', ...campos });
      } else {
        // A API atualiza um campo de cada vez: só envia o que mudou.
        const atual = mov as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(campos)) {
          const antes = atual[k] ?? null;
          const igual = typeof v === 'number' ? toNum(antes) === v && antes != null : antes === v;
          if (!igual) await updateCentralField('financeiro', mov.id, k, v);
        }
        await qc.invalidateQueries({ queryKey: ['central', 'financeiro'] });
      }
      toast.success(mov ? 'Fatura atualizada' : 'Fatura registada');
      onOpenChange(false);
    } catch (err) {
      toast.error(`Erro ao guardar: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!mov) return;
    try {
      await remove.mutateAsync(mov.id);
      toast.success('Fatura eliminada');
      onOpenChange(false);
    } catch (err) {
      toast.error(`Erro ao eliminar: ${errorMessage(err)}`);
    }
  }

  const carrosOrdenados = [...carros].sort((a, b) => (a.matricula || '').localeCompare(b.matricula || ''));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{mov ? 'Editar fatura de custo' : 'Nova fatura de custo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nº documento">
              <Input
                value={form.n_documento}
                onChange={(e) => set('n_documento', e.target.value)}
                placeholder="ex.: FT 2026/123"
              />
            </Field>
            <Field label="Data">
              <DateField value={form.data} onChange={(v) => set('data', v)} />
            </Field>
            <Field label="Descrição do serviço / produto" className="sm:col-span-2">
              <Input value={form.descricao} onChange={(e) => set('descricao', e.target.value)} />
            </Field>
            <Field label="Valor s/ IVA (€)" required={!mov}>
              <Input inputMode="decimal" value={form.semIva} onChange={(e) => set('semIva', e.target.value)} />
            </Field>
            <Field label="IVA (€)">
              <Input inputMode="decimal" value={form.iva} onChange={(e) => set('iva', e.target.value)} />
            </Field>
            {(soTotal || total != null) && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {soTotal && <>Registado só o total c/ IVA: {eur(Math.abs(toNum(mov!.valor)))}. </>}
                {total != null && <>Total c/ IVA: {eur(total)}</>}
              </p>
            )}
            <Field label="Centro de custo" required>
              <NativeSelect value={form.centro_custo} onChange={(e) => set('centro_custo', e.target.value)}>
                <option value="">— escolher —</option>
                {CENTROS_CUSTO.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Natureza do custo" required>
              <Input
                list="naturezas-custo"
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
                placeholder="escolher ou escrever"
              />
              <datalist id="naturezas-custo">
                {naturezas.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field label="Fornecedor">
              <Input value={form.contraparte} onChange={(e) => set('contraparte', e.target.value)} />
            </Field>
            <Field label="Viatura (opcional)">
              <NativeSelect value={form.carro_id} onChange={(e) => set('carro_id', e.target.value)}>
                <option value="">— sem viatura —</option>
                {carrosOrdenados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.matricula, c.marca_modelo, c.estado].filter(Boolean).join(' · ')} (#{c.id})
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {mov?.comprovativo && (
              <a
                href={mov.comprovativo}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline sm:col-span-2"
              >
                Ver fatura (Drive)
              </a>
            )}
          </div>
          <DialogFooter className="mt-5 flex-wrap gap-2 sm:justify-between">
            {mov ? <DeleteConfirm label="Eliminar" busy={remove.isPending} onConfirm={onDelete} /> : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
