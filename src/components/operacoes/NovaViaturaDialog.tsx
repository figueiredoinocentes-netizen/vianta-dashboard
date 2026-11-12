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
  camposCarroDeExtracao,
  driveFolderUrl,
  extrairDocumentos,
  importarFotosDaPasta,
  listDriveCarFolders,
  updateCentralField,
  uploadFatura,
} from '@/lib/operacoes/central';
import { CamposFaturaCompra } from '@/components/financeiro/FaturaCompra';
import {
  FATURA_COMPRA_VAZIA,
  hoje,
  registarFaturaCompra,
  validarFaturaCompra,
  type FaturaCompraValores,
} from '@/lib/faturaCompra';
import { toNum } from '@/lib/operacoes/custos';
import { faltamParaEstado } from '@/lib/operacoes/estadoRequisitos';
import { useCentralWrites, useInvestidores, useCarros, errorMessage } from '@/hooks/useOperacoes';
import { marcasRegistadas, nomeCarro } from '@/lib/operacoes/identidadeViatura';
import { Field, NativeSelect } from './shared';

const EMPTY = {
  marca: '',
  modelo: '',
  versao: '',
  matricula: '',
  ano: '',
  combustivel: '',
  combustivelSecundario: '',
  combustivelPrincipal: '',
  plugIn: '',
  kms: '',
  proprietario: 'VIANTA',
  investidorId: '',
  gestao: 'Aluguer',
  estado: 'Em Preparação',
  precoVenda: '',
  precoAluguer: '',
  precoCompra: '',
  aquisicao: '',
};


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
  const [fc, setFc] = useState<FaturaCompraValores>(FATURA_COMPRA_VAZIA);
  const qc = useQueryClient();
  const folders = useQuery({
    queryKey: ['drive-car-folders'],
    queryFn: listDriveCarFolders,
    staleTime: 5 * 60_000,
    retry: false,
    enabled: open,
  });
  const { data: investidores = [] } = useInvestidores();
  const { data: carros = [] } = useCarros();
  const marcas = marcasRegistadas(carros);
  const { create } = useCentralWrites('carros');

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const busy = status !== 'idle';
  const compra = form.aquisicao === 'Compra';

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
    // Uma viatura nova não tem ficha: só pode nascer em preparação e é lá que se
    // preenchem as características exigidas para a disponibilizar.
    if (faltamParaEstado({ combustivel: form.combustivel, combustivel_principal: form.combustivelPrincipal, combustivel_secundario: form.combustivelSecundario, plug_in: form.plugIn === '' ? null : form.plugIn === 'Sim' }, form.estado).length) {
      return toast.error(
        `Uma viatura nova não pode entrar diretamente em «${form.estado}». Cria-a em «Em Preparação» e preenche os campos obrigatórios da Ficha comercial antes de a disponibilizar.`,
        { duration: 9000 },
      );
    }
    if (compra) {
      const erro = validarFaturaCompra(fc, fatura);
      if (erro) return toast.error(erro);
    }
    setStatus('saving');
    try {
      // 1.º a fatura (se falhar, não se cria a viatura).
      const ficheiro = compra && fatura ? await uploadFatura(fatura, fc.data || hoje()) : null;
      const semIva = compra ? Math.abs(toNum(fc.semIva)) : 0;

      const isInvestidor = form.proprietario === 'Investidor';
      const investidor = isInvestidor
        ? investidores.find((i) => String(i.id) === form.investidorId)
        : null;
      const rows = await create.mutateAsync({
        matricula: form.matricula || null,
        marca: form.marca || null,
        marca_modelo: form.modelo || null,
        versao: form.versao || null,
        ano: form.ano || null,
        combustivel: form.combustivel || null,
        combustivel_secundario: form.combustivelSecundario || null,
        combustivel_principal: form.combustivelPrincipal || null,
        plug_in: form.combustivel === 'Híbrido' ? form.plugIn === 'Sim' : null,
        kms_atuais: form.kms || null,
        proprietario: isInvestidor ? (investidor ? investidor.nome : null) : 'VIANTA',
        investidor_id: investidor ? investidor.id : null,
        tipo_gestao: form.gestao || null,
        estado: form.estado || null,
        preco_venda: form.precoVenda || null,
        preco_compra: compra ? String(semIva) : form.precoCompra || null,
        data_compra: compra ? fc.data || null : null,
        aquisicao: form.aquisicao,
        valor_aluguer_semanal: form.precoAluguer || null,
      });
      const novoId = rows[0]?.id;
      if (compra && ficheiro) {
        try {
          await registarFaturaCompra({
            carroId: novoId ?? null,
            descricao: `Compra da viatura ${[form.matricula, nomeCarro({ marca: form.marca, marca_modelo: form.modelo, versao: form.versao })].filter(Boolean).join(' · ')}`,
            valores: fc,
            file: fatura!,
            gestao: form.gestao,
            ficheiro,
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
      setFc(FATURA_COMPRA_VAZIA);
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
            <Field label="Marca" required>
              <Input required list="marcas-registadas" value={form.marca} onChange={(e) => set('marca', e.target.value)} />
              <datalist id="marcas-registadas">{marcas.map((marca) => <option key={marca} value={marca} />)}</datalist>
            </Field>
            <Field label="Modelo" required>
              <Input required value={form.modelo} onChange={(e) => set('modelo', e.target.value)} />
            </Field>
            <Field label="Versão">
              <Input value={form.versao} onChange={(e) => set('versao', e.target.value)} />
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
            {form.combustivel === 'Híbrido' && <>
              <Field label="Combustível híbrido 1" required>
                <NativeSelect required value={form.combustivelPrincipal} onChange={(e) => set('combustivelPrincipal', e.target.value)}>
                  <option value="">Selecionar</option>
                  {COMBUSTIVEIS.filter((c) => c !== 'Híbrido').map((c) => <option key={c}>{c}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Combustível híbrido 2" required>
                <NativeSelect required value={form.combustivelSecundario} onChange={(e) => set('combustivelSecundario', e.target.value)}>
                  <option value="">Selecionar</option>
                  {COMBUSTIVEIS.filter((c) => c !== 'Híbrido' && c !== form.combustivelPrincipal).map((c) => <option key={c}>{c}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Plug-in?" required>
                <NativeSelect required value={form.plugIn} onChange={(e) => set('plugIn', e.target.value)}>
                  <option value="">Selecionar</option><option>Sim</option><option>Não</option>
                </NativeSelect>
              </Field>
            </>}
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
              <div className="space-y-2 rounded-lg border border-primary/40 bg-muted/30 p-3 sm:col-span-2">
                <p className="text-xs font-semibold text-foreground">
                  Fatura de compra — fica registada em Financeiro, ligada a esta viatura
                </p>
                <CamposFaturaCompra valores={fc} onChange={setFc} onFile={setFatura} gestao={form.gestao} />
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
                <option>Venda e Aluguer</option>
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
