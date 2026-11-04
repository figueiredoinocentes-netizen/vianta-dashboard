import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { COMBUSTIVEIS, STATUSES, normalizeText } from '@/lib/operacoes/constants';
import {
  MAX_FATURA_MB,
  camposCarroDeExtracao,
  createCentral,
  driveFolderUrl,
  extrairDocumentos,
  importarFotosDaPasta,
  listDriveCarFolders,
  updateCentralField,
  uploadFatura,
} from '@/lib/operacoes/central';
import { toNum } from '@/lib/operacoes/custos';
import { CENTROS_CUSTO } from '@/lib/financeiro';
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
  precoCompra: '',
  aquisicao: '',
  fatNum: '',
  fatData: '',
  fatFornecedor: '',
  fatSemIva: '',
  fatIva: '',
  fatCentro: '',
};

const hoje = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function NovaViaturaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState<'idle' | 'saving' | 'drive'>('idle');
  const [pasta, setPasta] = useState('');
  const [pastaManual, setPastaManual] = useState(false);
  const [fatura, setFatura] = useState<File | null>(null);
  const qc = useQueryClient();
  const folders = useQuery({
    queryKey: ['drive-car-folders'],
    queryFn: listDriveCarFolders,
    staleTime: 5 * 60_000,
    retry: false,
    enabled: open,
  });
  const { data: investidores = [] } = useInvestidores();
  const { create } = useCentralWrites('carros');

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const busy = status !== 'idle';
  const compra = form.aquisicao === 'Compra';
  // Centro de custo da fatura de compra: por defeito pelo tipo de gestão (Venda → Stand, resto → TVDE).
  const centroFatura = form.fatCentro || (form.gestao === 'Venda' ? 'Stand' : 'TVDE');

  // Sugere a pasta pela matrícula escrita (enquanto o utilizador não escolher uma à mão).
  useEffect(() => {
    if (pastaManual || !folders.data) return;
    const plate = normalizeText(form.matricula).replace(/[^a-z0-9]/g, '');
    const f =
      plate.length >= 4
        ? folders.data.find((x) => normalizeText(x.name).replace(/[^a-z0-9]/g, '').includes(plate))
        : undefined;
    setPasta(f?.id || '');
  }, [form.matricula, folders.data, pastaManual]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.aquisicao) return toast.error('Escolha se a viatura é de compra ou de consignação.');
    const semIva = compra ? Math.abs(toNum(form.fatSemIva)) : 0;
    const iva = compra && form.fatIva.trim() ? Math.abs(toNum(form.fatIva)) : 0;
    if (compra) {
      if (!fatura) return toast.error('Anexe a fatura de compra da viatura.');
      if (fatura.size > MAX_FATURA_MB * 1024 * 1024) return toast.error(`A fatura tem mais de ${MAX_FATURA_MB} MB.`);
      if (!semIva) return toast.error('Indique o valor s/ IVA da fatura de compra.');
    }
    setStatus('saving');
    try {
      // 1.º a fatura (se falhar, não se cria a viatura).
      const dataFatura = form.fatData || hoje();
      const ficheiro = compra && fatura ? await uploadFatura(fatura, dataFatura) : null;

      const isInvestidor = form.proprietario === 'Investidor';
      const investidor = isInvestidor
        ? investidores.find((i) => String(i.id) === form.investidorId)
        : null;
      const rows = await create.mutateAsync({
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
        preco_compra: compra ? String(semIva) : form.precoCompra || null,
        aquisicao: form.aquisicao,
        valor_aluguer_semanal: form.precoAluguer || null,
      });
      const novoId = rows[0]?.id;
      if (compra && ficheiro) {
        try {
          await createCentral('financeiro', {
            tipo: 'Compra',
            carro_id: novoId ?? null,
            n_documento: form.fatNum.trim() || null,
            data: dataFatura,
            descricao: `Compra da viatura ${[form.matricula, form.modelo].filter(Boolean).join(' · ')}`,
            contraparte: form.fatFornecedor.trim() || null,
            centro_custo: centroFatura,
            categoria: 'Compra de viatura',
            valor_sem_iva: -semIva,
            iva: -iva,
            valor: -round2(semIva + iva),
            ficheiro,
            ficheiro_nome: fatura!.name,
          });
          await qc.invalidateQueries({ queryKey: ['central', 'financeiro'] });
        } catch (err) {
          toast.error(`Viatura criada, mas a fatura de compra não foi registada no Financeiro: ${errorMessage(err)}`);
        }
      }
      if (pasta && novoId) {
        setStatus('drive');
        const r = await importarFotosDaPasta(pasta, []);
        if (r.semFotos) {
          toast.error('A pasta escolhida não tem subpasta "fotos": a viatura foi criada sem fotos da Drive.');
        } else {
          if (r.erro) toast.error(`Erro ao importar fotos: ${r.erro}`);
          if (r.urls.length) {
            await updateCentralField('carros', novoId, 'fotos', r.urls);
            await updateCentralField('carros', novoId, 'foto_url', r.urls[0]);
            toast.success(`${r.urls.length} foto(s) importada(s) da Drive.`);
          }
        }
        await updateCentralField('carros', novoId, 'fotos_link', driveFolderUrl(pasta));

        // Lê os dados do DUA/livrete da pasta e preenche os campos ainda vazios (ex: cor).
        try {
          const ext = await extrairDocumentos('carro', pasta);
          const preencher = camposCarroDeExtracao(ext.dados).filter(({ field }) => {
            const valor = (form as Record<string, unknown>)[
              field === 'marca_modelo' ? 'modelo' : field === 'matricula' ? 'matricula' : field
            ];
            return !valor || String(valor).trim() === '';
          });
          for (const { field, value } of preencher) await updateCentralField('carros', novoId, field, value);
          if (preencher.length) toast.success(`Dados lidos dos documentos: ${preencher.map((p) => p.field).join(', ')}.`);
        } catch {
          // Falhou a leitura dos documentos — a viatura fica criada na mesma, sem os campos extra.
        }
        await qc.invalidateQueries({ queryKey: ['central', 'carros'] });
      }
      setForm(EMPTY);
      setFatura(null);
      setPasta('');
      setPastaManual(false);
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Modelo" required className="sm:col-span-2">
              <Input required value={form.modelo} onChange={(e) => set('modelo', e.target.value)} />
            </Field>
            <Field label="Pasta da Drive (CARROS)" className="sm:col-span-2">
              <NativeSelect
                value={pasta}
                disabled={folders.isLoading}
                onChange={(e) => {
                  setPasta(e.target.value);
                  setPastaManual(true);
                }}
              >
                <option value="">
                  {folders.isLoading
                    ? 'A carregar pastas…'
                    : folders.isError
                      ? 'Erro ao ler a Drive'
                      : 'Sem pasta (opcional)'}
                </option>
                {(folders.data || []).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="mt-1 text-[11px] text-muted-foreground">
                As imagens da subpasta "fotos" são importadas ao guardar. A capa escolhe-se depois, na ficha.
              </p>
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
            <Field label="Aquisição" required className="sm:col-span-2">
              <NativeSelect required value={form.aquisicao} onChange={(e) => set('aquisicao', e.target.value)}>
                <option value="">— escolher —</option>
                <option value="Compra">Compra (com fatura de compra)</option>
                <option value="Consignação">Consignação</option>
              </NativeSelect>
            </Field>
            {compra && (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-primary/40 bg-muted/30 p-3 sm:col-span-2 sm:grid-cols-2">
                <p className="text-xs font-semibold text-foreground sm:col-span-2">
                  Fatura de compra — fica registada em Financeiro, ligada a esta viatura
                </p>
                <Field label="Fatura (PDF ou imagem)" required className="sm:col-span-2">
                  <Input
                    type="file"
                    required
                    accept="application/pdf,image/*"
                    onChange={(e) => setFatura(e.target.files?.[0] || null)}
                  />
                </Field>
                <Field label="Nº documento">
                  <Input value={form.fatNum} onChange={(e) => set('fatNum', e.target.value)} placeholder="ex.: FT 2026/123" />
                </Field>
                <Field label="Data da fatura">
                  <Input type="date" value={form.fatData || hoje()} onChange={(e) => set('fatData', e.target.value)} />
                </Field>
                <Field label="Fornecedor" className="sm:col-span-2">
                  <Input value={form.fatFornecedor} onChange={(e) => set('fatFornecedor', e.target.value)} />
                </Field>
                <Field label="Valor s/ IVA (€)" required>
                  <Input
                    required
                    inputMode="decimal"
                    value={form.fatSemIva}
                    onChange={(e) => set('fatSemIva', e.target.value)}
                  />
                </Field>
                <Field label="IVA (€)">
                  <Input
                    inputMode="decimal"
                    value={form.fatIva}
                    onChange={(e) => set('fatIva', e.target.value)}
                    placeholder="0 se regime da margem"
                  />
                </Field>
                <Field label="Centro de custo" className="sm:col-span-2">
                  <NativeSelect value={centroFatura} onChange={(e) => set('fatCentro', e.target.value)}>
                    {CENTROS_CUSTO.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <p className="text-[11px] text-muted-foreground sm:col-span-2">
                  O valor s/ IVA passa a ser o preço de compra da viatura.
                </p>
              </div>
            )}
            <Field label="Proprietário" className="sm:col-span-2">
              <NativeSelect
                value={form.proprietario}
                onChange={(e) => set('proprietario', e.target.value)}
              >
                <option value="VIANTA">VIANTA</option>
                <option value="Investidor">Investidor</option>
              </NativeSelect>
            </Field>
            {form.proprietario === 'Investidor' && (
              <Field label="Investidor" className="sm:col-span-2">
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
            {!compra && (
              <Field label="Preço de compra (€, s/ IVA)">
                <Input
                  type="number"
                  value={form.precoCompra}
                  onChange={(e) => set('precoCompra', e.target.value)}
                />
              </Field>
            )}
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
              {status === 'drive' ? 'A importar fotos…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
