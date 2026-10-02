import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listDriveFiles, uploadDriveDoc } from '@/lib/operacoes/central';
import { TIPOS_CUSTO, toNum } from '@/lib/operacoes/custos';
import type { Carro } from '@/lib/operacoes/types';
import { errorMessage } from '@/hooks/useOperacoes';
import { Field, NativeSelect } from './shared';

const hoje = () => new Date().toISOString().slice(0, 10);

/** Formulário de registo de um custo da viatura. `extra` junta campos fixos ao registo (ex.: ligação a um item da checklist). */
export function NovoMovimento({
  carro,
  busy,
  onSave,
  onCancel,
  cancelLabel = 'Cancelar',
  defaultCategoria,
  defaultDescricao = '',
  extra,
}: {
  carro: Carro;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  cancelLabel?: string;
  defaultCategoria?: string;
  defaultDescricao?: string;
  extra?: Record<string, unknown>;
}) {
  const [tipo, setTipo] = useState<string>(defaultCategoria || TIPOS_CUSTO[0]);
  const [data, setData] = useState(hoje());
  const [descricao, setDescricao] = useState(defaultDescricao);
  const [fornecedor, setFornecedor] = useState('');
  const [kms, setKms] = useState(String(carro.kms_atuais ?? ''));
  const [total, setTotal] = useState('');
  const [semIvaStr, setSemIvaStr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  // Pasta da viatura na Drive (para guardar a fatura).
  const drive = useQuery({
    queryKey: ['drive', carro.id, carro.matricula, carro.marca_modelo, carro.fotos_link],
    queryFn: () =>
      listDriveFiles(
        carro.matricula || '',
        carro.marca_modelo || '',
        (carro.fotos_link || '').match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1],
      ),
    staleTime: 60_000,
    retry: false,
  });

  async function submit() {
    const t = toNum(total);
    if (!t) return toast.error('Indique o valor total.');
    const s = semIvaStr ? toNum(semIvaStr) : null;
    const sinal = -1; // custo
    setSending(true);
    try {
      let comprovativo: string | null = null;
      if (file) {
        const folder = drive.data?.folder;
        if (!folder) throw new Error('pasta da viatura na Drive não encontrada');
        const ext = (file.name.match(/\.[a-z0-9]+$/i) || [''])[0];
        const nome = `Fatura ${data} ${tipo}${ext}`.replace(/[\\/:*?"<>|]/g, '');
        const up = await uploadDriveDoc({ folderId: folder.id, filename: nome, contentType: file.type, file });
        comprovativo = up?.webViewLink || null;
      }
      await onSave({
        carro_id: carro.id,
        data,
        tipo: 'Custo',
        categoria: tipo,
        descricao: descricao || null,
        contraparte: fornecedor || null,
        kms: kms || null,
        valor: sinal * Math.abs(t),
        valor_sem_iva: s == null ? null : sinal * Math.abs(s),
        iva: s == null ? null : sinal * Math.round(Math.abs(t - s) * 100) / 100,
        comprovativo,
        ...extra,
      });
    } catch (e) {
      toast.error(`Erro ao registar: ${errorMessage(e)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="grid grid-cols-2 gap-3 rounded-lg border border-primary/40 bg-muted/30 p-3"
      // Dentro de um <form> (aba Preparação) o Enter nos campos não deve submeter a ficha da viatura.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
      }}
    >
      <Field label="Categoria">
        <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS_CUSTO.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Data">
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Field>
      <Field label="O que foi feito" className="col-span-2">
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="ex.: revisão, óleo e filtros"
        />
      </Field>
      <Field label="Fornecedor / cliente">
        <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
      </Field>
      <Field label="KMs">
        <Input inputMode="numeric" value={kms} onChange={(e) => setKms(e.target.value)} />
      </Field>
      <Field label="Valor total c/ IVA (€)" required>
        <Input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
      </Field>
      <Field label="Valor s/ IVA (€)">
        <Input inputMode="decimal" value={semIvaStr} onChange={(e) => setSemIvaStr(e.target.value)} />
      </Field>
      <Field label="Fatura (PDF ou foto)" className="col-span-2">
        <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        {file && drive.data && !drive.data.folder && (
          <p className="mt-1 text-[11px] text-destructive">
            Pasta da viatura na Drive não encontrada — a fatura não pode ser enviada.
          </p>
        )}
      </Field>
      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" disabled={busy || sending} onClick={submit}>
          {sending ? 'A guardar…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}
