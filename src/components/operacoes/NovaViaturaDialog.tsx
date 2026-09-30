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
import { COMBUSTIVEIS, STATUSES } from '@/lib/operacoes/constants';
import { uploadFoto } from '@/lib/operacoes/central';
import { useCentralWrites, useInvestidores, errorMessage } from '@/hooks/useOperacoes';
import { Field, NativeSelect } from './shared';

const EMPTY = {
  modelo: '',
  matricula: '',
  ano: '',
  combustivel: '',
  kms: '',
  proprietario: 'VIANTA',
  investidorId: '',
  gestao: 'Aluguer',
  estado: 'Em Preparação',
  precoVenda: '',
  precoAluguer: '',
};

export function NovaViaturaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [foto, setFoto] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'foto' | 'saving'>('idle');
  const { data: investidores = [] } = useInvestidores();
  const { create } = useCentralWrites('carros');

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const busy = status !== 'idle';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      let fotoUrl: string | null = null;
      if (foto) {
        setStatus('foto');
        fotoUrl = await uploadFoto(foto);
      }
      const isInvestidor = form.proprietario === 'Investidor';
      const investidor = isInvestidor
        ? investidores.find((i) => String(i.id) === form.investidorId)
        : null;
      await create.mutateAsync({
        matricula: form.matricula || null,
        marca_modelo: form.modelo || null,
        ano: form.ano || null,
        combustivel: form.combustivel || null,
        kms_atuais: form.kms || null,
        proprietario: isInvestidor ? (investidor ? investidor.nome : null) : 'VIANTA',
        investidor_id: investidor ? investidor.id : null,
        tipo_gestao: form.gestao || null,
        estado: form.estado || null,
        preco_venda: form.precoVenda || null,
        valor_aluguer_semanal: form.precoAluguer || null,
        foto_url: fotoUrl,
      });
      setForm(EMPTY);
      setFoto(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(`Erro ao guardar: ${errorMessage(err)}`);
    } finally {
      setStatus('idle');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Nova Viatura</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modelo" required className="col-span-2">
              <Input required value={form.modelo} onChange={(e) => set('modelo', e.target.value)} />
            </Field>
            <Field label="Foto" className="col-span-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setFoto(e.target.files?.[0] || null)}
              />
            </Field>
            <Field label="Matrícula">
              <Input value={form.matricula} onChange={(e) => set('matricula', e.target.value)} />
            </Field>
            <Field label="Ano">
              <Input
                type="number"
                min={2010}
                max={2026}
                value={form.ano}
                onChange={(e) => set('ano', e.target.value)}
              />
            </Field>
            <Field label="Combustível">
              <NativeSelect
                value={form.combustivel}
                onChange={(e) => set('combustivel', e.target.value)}
              >
                <option value="">Selecionar</option>
                {COMBUSTIVEIS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="KMs">
              <Input type="number" value={form.kms} onChange={(e) => set('kms', e.target.value)} />
            </Field>
            <Field label="Proprietário" className="col-span-2">
              <NativeSelect
                value={form.proprietario}
                onChange={(e) => set('proprietario', e.target.value)}
              >
                <option value="VIANTA">VIANTA</option>
                <option value="Investidor">Investidor</option>
              </NativeSelect>
            </Field>
            {form.proprietario === 'Investidor' && (
              <Field label="Investidor" className="col-span-2">
                <NativeSelect
                  value={form.investidorId}
                  onChange={(e) => set('investidorId', e.target.value)}
                >
                  <option value="">Selecionar</option>
                  {[...investidores]
                    .sort((a, b) => a.nome.localeCompare(b.nome))
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Tipo Gestão">
              <NativeSelect value={form.gestao} onChange={(e) => set('gestao', e.target.value)}>
                <option>Aluguer</option>
                <option>Venda</option>
                <option>Slot</option>
              </NativeSelect>
            </Field>
            <Field label="Estado">
              <NativeSelect value={form.estado} onChange={(e) => set('estado', e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Preço Venda (€)">
              <Input
                type="number"
                value={form.precoVenda}
                onChange={(e) => set('precoVenda', e.target.value)}
              />
            </Field>
            <Field label="Valor Aluguer (€/sem)">
              <Input
                type="number"
                value={form.precoAluguer}
                onChange={(e) => set('precoAluguer', e.target.value)}
              />
            </Field>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {status === 'foto' ? 'A enviar foto...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
