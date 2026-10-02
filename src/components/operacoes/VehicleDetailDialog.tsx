import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  COMBUSTIVEIS,
  DOC_KEYWORDS,
  STATUSES,
  getChecklist,
  getChecklistGroups,
  normalizeText,
} from '@/lib/operacoes/constants';
import { listDriveFiles, uploadDriveDoc } from '@/lib/operacoes/central';
import type { Carro, DriveFile } from '@/lib/operacoes/types';
import {
  useCarros,
  useCentralWrites,
  useClientes,
  useInvestidores,
  useMotoristas,
  useToggleChecklistItem,
  useUpdateCarroField,
  errorMessage,
} from '@/hooks/useOperacoes';
import { ClienteDialog } from './ClienteDialog';
import { CustosViatura } from './CustosViatura';
import { FotosEditor } from './FotosEditor';
import { DeleteConfirm, Field, NativeSelect } from './shared';

interface Form {
  modelo: string;
  matricula: string;
  ano: string;
  combustivel: string;
  kms: string;
  proprietario: string;
  investidorId: string;
  gestao: string;
  estado: string;
  precoVenda: string;
  precoAluguer: string;
  motoristaAtual: string;
  clienteId: string;
  previsaoPronto: string;
  versao: string;
  cor: string;
  caixa: string;
  autonomiaKm: string;
  categoriasTvde: string;
  caucao: string;
  garantiaViatura: string;
  garantiaBateria: string;
  cavalos: string;
  bateriaKwh: string;
  volumeBagageira: string;
  estadoBateriaPct: string;
  credito120: string;
  credito60: string;
  credito48: string;
  fimElegibilidadeTvde: string;
  docsLink: string;
  obs: string;
}

const CAIXAS = ['Automático', 'Manual'] as const;

const s = (x: string | number | null | undefined) => (x == null ? '' : String(x));

function formFromCarro(v: Carro): Form {
  return {
    modelo: s(v.marca_modelo),
    matricula: s(v.matricula),
    ano: s(v.ano),
    combustivel: s(v.combustivel),
    kms: s(v.kms_atuais),
    proprietario: v.investidor_id ? 'Investidor' : 'VIANTA',
    investidorId: v.investidor_id ? String(v.investidor_id) : '',
    gestao: v.tipo_gestao || 'Aluguer',
    estado: v.estado || 'Alugado',
    precoVenda: s(v.preco_venda),
    precoAluguer: s(v.valor_aluguer_semanal),
    motoristaAtual: s(v.motorista_atual),
    clienteId: v.cliente_id ? String(v.cliente_id) : '',
    previsaoPronto: s(v.data_previsao_pronto),
    versao: s(v.versao),
    cor: s(v.cor),
    caixa: s(v.caixa),
    autonomiaKm: s(v.autonomia_km),
    categoriasTvde: s(v.categorias_tvde),
    caucao: s(v.caucao),
    garantiaViatura: s(v.garantia_viatura),
    garantiaBateria: s(v.garantia_bateria),
    cavalos: s(v.cavalos),
    bateriaKwh: s(v.bateria_kwh),
    volumeBagageira: s(v.volume_bagageira),
    estadoBateriaPct: s(v.estado_bateria_pct),
    credito120: s(v.credito_120_meses),
    credito60: s(v.credito_60_meses),
    credito48: s(v.credito_48_meses),
    fimElegibilidadeTvde: s(v.fim_elegibilidade_tvde),
    docsLink: s(v.docs_link),
    obs: s(v.obs),
  };
}

function matchFileForItem(item: string, files: DriveFile[] | undefined): DriveFile | null {
  const keywords = DOC_KEYWORDS[item];
  if (!keywords || !files) return null;
  return files.find((f) => keywords.some((k) => normalizeText(f.name).includes(k))) || null;
}

export function VehicleDetailDialog({
  carId,
  onClose,
}: {
  carId: number | null;
  onClose: () => void;
}) {
  const open = carId != null;
  const { data: carros = [] } = useCarros();
  const carro = carros.find((c) => c.id === carId) || null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
        aria-describedby={undefined}
      >
        {carro && <Body key={carro.id} carro={carro} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ carro, onClose }: { carro: Carro; onClose: () => void }) {
  const [tab, setTab] = useState<'carac' | 'ficha' | 'prep' | 'custos'>('carac');
  const [form, setForm] = useState<Form>(() => formFromCarro(carro));
  const [saving, setSaving] = useState<'idle' | 'saving'>('idle');
  const [clienteOpen, setClienteOpen] = useState(false);

  const { data: investidores = [] } = useInvestidores();
  const { data: clientes = [] } = useClientes();
  const { data: motoristas = [] } = useMotoristas();
  const update = useUpdateCarroField();
  const { remove } = useCentralWrites('carros');

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Reflete mudanças de fora (ex.: estado alterado noutra vista) se o pop-up
  // continuar aberto, mas só quando o utilizador ainda não mexeu no formulário.
  useEffect(() => {
    setForm(formFromCarro(carro));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carro.id]);

  const nomes = Array.from(
    new Set(motoristas.map((m) => m.nome).filter((n): n is string => !!n)),
  ).sort();
  if (carro.motorista_atual && !nomes.includes(carro.motorista_atual)) {
    nomes.push(carro.motorista_atual);
  }

  const isVenda = form.gestao === 'Venda';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const isInvestidor = form.proprietario === 'Investidor';
    const investidor = isInvestidor
      ? investidores.find((i) => String(i.id) === form.investidorId)
      : null;

    setSaving('saving');

    const updates: Record<string, string | number | null> = {
      marca_modelo: form.modelo || null,
      matricula: form.matricula || null,
      ano: form.ano || null,
      combustivel: form.combustivel || null,
      kms_atuais: form.kms || null,
      proprietario: isInvestidor ? (investidor ? investidor.nome : null) : 'VIANTA',
      investidor_id: investidor ? investidor.id : null,
      tipo_gestao: form.gestao || null,
      estado: form.estado || null,
      preco_venda: isVenda ? form.precoVenda || null : null,
      valor_aluguer_semanal: !isVenda ? form.precoAluguer || null : null,
      motorista_atual: form.estado === 'Em Preparação' ? null : form.motoristaAtual || null,
      cliente_id: form.estado === 'Vendido' && form.clienteId ? Number(form.clienteId) : null,
      data_previsao_pronto: form.previsaoPronto || null,
      versao: form.versao || null,
      cor: form.cor || null,
      caixa: form.caixa || null,
      autonomia_km: form.autonomiaKm || null,
      categorias_tvde: form.categoriasTvde || null,
      caucao: form.caucao || null,
      garantia_viatura: form.garantiaViatura || null,
      garantia_bateria: form.garantiaBateria || null,
      cavalos: form.cavalos || null,
      bateria_kwh: form.bateriaKwh || null,
      volume_bagageira: form.volumeBagageira || null,
      estado_bateria_pct: form.estadoBateriaPct || null,
      credito_120_meses: form.credito120 || null,
      credito_60_meses: form.credito60 || null,
      credito_48_meses: form.credito48 || null,
      fim_elegibilidade_tvde: form.fimElegibilidadeTvde || null,
      docs_link: form.docsLink || null,
      obs: form.obs || null,
    };

    try {
      for (const [field, value] of Object.entries(updates)) {
        const current = (carro as unknown as Record<string, unknown>)[field];
        if ((current ?? null) === value || String(current ?? '') === String(value ?? '')) continue;
        const ok = await update(carro, field, value);
        if (!ok) return;
      }
      onClose();
    } finally {
      setSaving('idle');
    }
  }

  async function onDelete() {
    try {
      await remove.mutateAsync(carro.id);
      onClose();
    } catch (err) {
      toast.error(`Erro ao eliminar: ${errorMessage(err)}`);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {(carro.marca_modelo || 'Viatura') + (carro.matricula ? ` — ${carro.matricula}` : '')}
        </DialogTitle>
      </DialogHeader>

      <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
        {(
          [
            ['carac', 'Características'],
            ['ficha', 'Ficha comercial'],
            ['prep', 'Preparação'],
            ['custos', 'Custos'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'custos' && (
        <>
          <CustosViatura carro={carro} />
          <div className="mt-5 flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className={tab === 'custos' ? 'hidden' : undefined}>
        {tab === 'carac' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col items-stretch gap-4 sm:col-span-2 sm:flex-row sm:items-start">
              <div className="flex h-52 w-full shrink-0 items-center sm:w-60 justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
                {carro.foto_url ? (
                  <img src={carro.foto_url} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="px-3 text-center text-xs text-muted-foreground">
                    Sem foto. Importe-as no separador Ficha comercial.
                  </span>
                )}
              </div>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                <Field label="Modelo" className="sm:col-span-2">
                  <Input value={form.modelo} onChange={(e) => set('modelo', e.target.value)} />
                </Field>
                <Field label="Matrícula">
                  <Input value={form.matricula} onChange={(e) => set('matricula', e.target.value)} />
                </Field>
                <Field label="Ano">
                  <Input value={form.ano} onChange={(e) => set('ano', e.target.value)} />
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
                  <Input value={form.kms} onChange={(e) => set('kms', e.target.value)} />
                </Field>
              </div>
            </div>
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
                {STATUSES.map((st) => (
                  <option key={st}>{st}</option>
                ))}
              </NativeSelect>
            </Field>
            {isVenda ? (
              <Field label="Preço Venda (€)" className="sm:col-span-2">
                <Input
                  value={form.precoVenda}
                  onChange={(e) => set('precoVenda', e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Valor Aluguer (€/sem)" className="sm:col-span-2">
                <Input
                  value={form.precoAluguer}
                  onChange={(e) => set('precoAluguer', e.target.value)}
                />
              </Field>
            )}
            {form.gestao === 'Aluguer' && (() => {
              const fromDb = parseFloat(form.caucao || '0');
              const fromPvp = parseFloat(form.precoVenda || '0');
              const total = fromDb > 0 ? fromDb : (fromPvp > 25000 ? 600 : 400);
              const meta = total === 600 ? '300€' : '200€';
              const p1 = total === 600 ? '100€' : '100€';
              const p2 = total === 600 ? '100€' : '100€';
              const p3 = total === 600 ? '+ 100€' : '';
              return (
                <div className="sm:col-span-2">
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <div className="mb-3 text-base font-semibold">
                      💳 Caução: <span className="text-primary font-bold">{total}€</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md bg-muted/60 p-3">
                        <div className="mb-1.5 font-semibold text-foreground">📋 Prestações Vianta</div>
                        <div className="mb-2 text-xs text-muted-foreground">Sem juros, gerido internamente</div>
                        <div className="text-2xl font-bold text-primary">{meta}</div>
                        <div className="text-xs text-muted-foreground">1.ª prestação (entrega)</div>
                        <div className="mt-2 text-xs text-muted-foreground">Depois: <strong>{p1}</strong> + <strong>{p2}</strong> {p3} (mensal)</div>
                      </div>
                      <div className="rounded-md bg-muted/60 p-3">
                        <div className="mb-1.5 font-semibold text-foreground">🏦 Parcela Já</div>
                        <div className="mb-2 text-xs text-muted-foreground">Crédito no terminal, débito automático</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <div className="mt-1 text-green-500">✅ CC português</div>
                          <div className="text-green-500">✅ Cartão multibanco (mesma pessoa)</div>
                          <div className="mt-1 text-yellow-400">Atenção: verificação BdP</div>
                        </div>
                        <div className="mt-2 rounded-md bg-indigo-500/15 px-2.5 py-1.5 text-[11px] text-indigo-300">
                          ⚠️ Se faltar CC português ou cartão multibanco<br />da mesma pessoa → <span className="text-primary font-semibold">Opção 1</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            {form.estado !== 'Em Preparação' && (
              <Field label="Motorista Atual" className="sm:col-span-2">
                <NativeSelect
                  value={form.motoristaAtual}
                  onChange={(e) => set('motoristaAtual', e.target.value)}
                >
                  <option value="">Nenhum</option>
                  {nomes.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {form.estado === 'Vendido' && (
              <Field label="Cliente (comprador)" className="sm:col-span-2">
                <div className="flex gap-2">
                  <NativeSelect
                    className="flex-1"
                    value={form.clienteId}
                    onChange={(e) => set('clienteId', e.target.value)}
                  >
                    <option value="">Selecionar</option>
                    {[...clientes]
                      .sort((a, b) => a.nome.localeCompare(b.nome))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="outline"
                    title="Novo cliente"
                    onClick={() => setClienteOpen(true)}
                  >
                    + Novo
                  </Button>
                </div>
              </Field>
            )}
          </div>
        )}

        {tab === 'ficha' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Versão" className="sm:col-span-2">
              <Input value={form.versao} onChange={(e) => set('versao', e.target.value)} />
            </Field>
            <Field label="Cor">
              <Input value={form.cor} onChange={(e) => set('cor', e.target.value)} />
            </Field>
            <Field label="Caixa">
              <NativeSelect value={form.caixa} onChange={(e) => set('caixa', e.target.value)}>
                <option value="">Selecionar</option>
                {[...CAIXAS, ...(form.caixa && !CAIXAS.includes(form.caixa as never) ? [form.caixa] : [])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Cavalos (cv)">
              <Input value={form.cavalos} onChange={(e) => set('cavalos', e.target.value)} />
            </Field>
            <Field label="Volume da bagageira (L)">
              <Input
                value={form.volumeBagageira}
                onChange={(e) => set('volumeBagageira', e.target.value)}
              />
            </Field>
            <Field label="Bateria (kWh)">
              <Input value={form.bateriaKwh} onChange={(e) => set('bateriaKwh', e.target.value)} />
            </Field>
            <Field label="Estado da bateria (%)">
              <Input
                value={form.estadoBateriaPct}
                onChange={(e) => set('estadoBateriaPct', e.target.value)}
              />
            </Field>
            <Field label="Autonomia (km)">
              <Input value={form.autonomiaKm} onChange={(e) => set('autonomiaKm', e.target.value)} />
            </Field>
            <Field label="Caução (€)">
              <Input value={form.caucao} onChange={(e) => set('caucao', e.target.value)} />
            </Field>
            <Field label="Categorias TVDE" className="sm:col-span-2">
              <Input
                value={form.categoriasTvde}
                onChange={(e) => set('categoriasTvde', e.target.value)}
              />
            </Field>
            <Field label="Garantia viatura">
              <Input
                value={form.garantiaViatura}
                onChange={(e) => set('garantiaViatura', e.target.value)}
              />
            </Field>
            <Field label="Garantia bateria">
              <Input
                value={form.garantiaBateria}
                onChange={(e) => set('garantiaBateria', e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2 mt-2 border-t border-border pt-3 text-xs font-medium text-muted-foreground">
              Simulação de crédito — prestação mensal (€)
            </div>
            <Field label="120 meses (10 anos)">
              <Input value={form.credito120} onChange={(e) => set('credito120', e.target.value)} />
            </Field>
            <Field label="60 meses (5 anos)">
              <Input value={form.credito60} onChange={(e) => set('credito60', e.target.value)} />
            </Field>
            <Field label="48 meses (4 anos)">
              <Input value={form.credito48} onChange={(e) => set('credito48', e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <FotosEditor carro={carro} />
            </div>
            <Field label="Fim de elegibilidade TVDE">
              <Input
                value={form.fimElegibilidadeTvde}
                onChange={(e) => set('fimElegibilidadeTvde', e.target.value)}
              />
            </Field>
            <Field label="Documentos (link)" className="sm:col-span-2">
              <Input value={form.docsLink} onChange={(e) => set('docsLink', e.target.value)} />
            </Field>
            <Field label="Observações" className="sm:col-span-2">
              <Input value={form.obs} onChange={(e) => set('obs', e.target.value)} />
            </Field>
          </div>
        )}

        {tab === 'prep' && (
          <div className="space-y-4">
            <Field label="Previsão de pronto">
              <Input
                type="date"
                value={form.previsaoPronto}
                onChange={(e) => set('previsaoPronto', e.target.value)}
              />
            </Field>
            <ChecklistEditor carro={carro} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <DeleteConfirm label="Eliminar Viatura" busy={remove.isPending} onConfirm={onDelete} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button type="submit" disabled={saving !== 'idle'}>
              Guardar Alterações
            </Button>
          </div>
        </div>
      </form>

      <ClienteDialog
        open={clienteOpen}
        onOpenChange={setClienteOpen}
        onSaved={(newId) => {
          if (newId) set('clienteId', String(newId));
        }}
      />
    </>
  );
}

/** Checklist de preparação, com os documentos ligados à pasta da viatura na Drive. */
function ChecklistEditor({ carro }: { carro: Carro }) {
  const toggle = useToggleChecklistItem();
  const [uploading, setUploading] = useState<string | null>(null);

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

  const groups = getChecklistGroups(carro);
  const done = carro.checklist_prep || {};

  if (!getChecklist(carro).length) {
    return (
      <div>
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Checklist de preparação
        </div>
        <p className="text-sm text-muted-foreground">
          Sem checklist definida para {carro.tipo_gestao || 'este tipo'}.
        </p>
      </div>
    );
  }

  async function onUpload(item: string, file: File | undefined) {
    const folder = drive.data?.folder;
    if (!file || !folder) return;
    setUploading(item);
    try {
      const ext = (file.name.match(/\.[a-z0-9]+$/i) || [''])[0];
      const filename = item.replace(/[^\p{L}\p{N} ]/gu, '').trim() + ext;
      await uploadDriveDoc({
        folderId: folder.id,
        filename,
        contentType: file.type,
        file,
      });
      await drive.refetch();
    } catch (err) {
      toast.error(`Erro ao enviar documento: ${errorMessage(err)}`);
    } finally {
      setUploading(null);
    }
  }

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">Checklist de preparação</div>
      {Object.entries(groups).map(([label, items]) => {
        if (!items.length) return null;
        const isDocs = label === 'Documentos';
        return (
          <div key={label} className="mb-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">
              {label}
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map((item) => {
                const file = isDocs ? matchFileForItem(item, drive.data?.files) : null;
                const inputId = `docup-${carro.id}-${normalizeText(item).replace(/[^a-z0-9]/g, '')}`;
                return (
                  <div key={item} className="flex flex-wrap items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={!!done[item]}
                        onChange={() => toggle(carro, item)}
                        className="accent-[hsl(var(--primary))]"
                      />
                      {item}
                    </label>
                    {isDocs && (
                      <span className="inline-flex items-center gap-1.5">
                        {drive.isLoading ? (
                          <span className="text-[11px] text-muted-foreground">a procurar...</span>
                        ) : uploading === item ? (
                          <span className="text-[11px] text-muted-foreground">a enviar...</span>
                        ) : (
                          <>
                            {file && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="max-w-[160px] truncate rounded bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:underline"
                              >
                                📄 {file.name}
                              </a>
                            )}
                            {drive.data?.folder && (
                              <label
                                htmlFor={inputId}
                                title={file ? 'Substituir ficheiro' : 'Enviar documento'}
                                className="cursor-pointer whitespace-nowrap rounded border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-primary hover:text-primary"
                              >
                                {file ? '🔄' : '📤 Adicionar'}
                                <input
                                  type="file"
                                  id={inputId}
                                  className="hidden"
                                  onChange={(e) => {
                                    onUpload(item, e.target.files?.[0]);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
