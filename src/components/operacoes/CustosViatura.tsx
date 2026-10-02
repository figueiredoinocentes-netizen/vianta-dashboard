import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listDriveFiles, uploadDriveDoc } from '@/lib/operacoes/central';
import type { Carro } from '@/lib/operacoes/types';
import {
  errorMessage,
  useCentralWrites,
  useFinanceiro,
  useUpdateCarroField,
} from '@/hooks/useOperacoes';
import { TIPOS_CUSTO, TIPOS_RECEITA, eur, resumoCarro, semIva, toNum } from '@/lib/operacoes/custos';
import { Field, NativeSelect } from './shared';

const hoje = () => new Date().toISOString().slice(0, 10);

export function CustosViatura({ carro }: { carro: Carro }) {
  const { data: todos = [], isLoading } = useFinanceiro();
  const { create, remove } = useCentralWrites('financeiro');
  const update = useUpdateCarroField();
  const [compra, setCompra] = useState(String(carro.preco_compra ?? ''));
  const [adding, setAdding] = useState(false);

  const movs = useMemo(
    () =>
      todos
        .filter((m) => m.carro_id === carro.id)
        .sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))),
    [todos, carro.id],
  );
  const r = resumoCarro(carro, movs);
  const isVenda = carro.tipo_gestao === 'Venda';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Compra (s/ IVA)" value={r.compra ? eur(r.compra) : '—'} />
        <Stat label="Custos (s/ IVA)" value={eur(r.custos)} />
        <Stat
          label={isVenda ? (r.vendido ? 'Vendido por' : 'Preço de venda') : 'Receitas'}
          value={eur(isVenda ? r.venda || r.receitas : r.receitas)}
        />
        <Stat
          label={isVenda && !r.vendido ? 'Margem prevista' : 'Margem'}
          value={eur(r.margem)}
          tone={r.margem < 0 ? 'neg' : 'pos'}
        />
      </div>

      <div className="flex items-end gap-2">
        <Field label="Preço de compra (s/ IVA)" className="max-w-[220px]">
          <Input
            inputMode="decimal"
            value={compra}
            onChange={(e) => setCompra(e.target.value)}
            onBlur={() => {
              if (compra !== String(carro.preco_compra ?? '')) {
                update(carro, 'preco_compra', compra || null).then(
                  (ok) => ok && toast.success('Preço de compra guardado'),
                );
              }
            }}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          Histórico de intervenções e custos
        </div>
        {!adding && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            + Registar
          </Button>
        )}
      </div>

      {adding && (
        <NovoMovimento
          carro={carro}
          busy={create.isPending}
          onCancel={() => setAdding(false)}
          onSave={async (body) => {
            try {
              await create.mutateAsync(body);
              setAdding(false);
              toast.success('Movimento registado');
            } catch (e) {
              toast.error(`Erro ao registar: ${errorMessage(e)}`);
            }
          }}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : !movs.length ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Ainda sem movimentos registados nesta viatura.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {movs.map((m) => {
            const v = toNum(m.valor);
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {m.tipo || 'Movimento'}
                    {m.contraparte && (
                      <span className="font-normal text-muted-foreground"> · {m.contraparte}</span>
                    )}
                  </div>
                  {m.descricao && <div className="text-sm text-foreground/80">{m.descricao}</div>}
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.data || 'sem data'}
                    {m.kms ? ` · ${m.kms} km` : ''}
                    {m.comprovativo && (
                      <>
                        {' · '}
                        <a
                          href={m.comprovativo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          📄 fatura
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={v < 0 ? 'text-sm font-semibold' : 'text-sm font-semibold text-emerald-500'}>
                    {eur(v)}
                  </div>
                  {m.valor_sem_iva != null && (
                    <div className="text-[11px] text-muted-foreground">s/ IVA {eur(semIva(m))}</div>
                  )}
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (window.confirm('Apagar este movimento?')) remove.mutate(m.id);
                    }}
                  >
                    apagar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={
          'text-base font-semibold ' +
          (tone === 'neg' ? 'text-destructive' : tone === 'pos' ? 'text-emerald-500' : '')
        }
      >
        {value}
      </div>
    </div>
  );
}

function NovoMovimento({
  carro,
  busy,
  onSave,
  onCancel,
}: {
  carro: Carro;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState<string>(TIPOS_CUSTO[0]);
  const [data, setData] = useState(hoje());
  const [descricao, setDescricao] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [kms, setKms] = useState(String(carro.kms_atuais ?? ''));
  const [total, setTotal] = useState('');
  const [semIvaStr, setSemIvaStr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const isReceita = (TIPOS_RECEITA as readonly string[]).includes(tipo);

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
    const sinal = isReceita ? 1 : -1;
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
        tipo,
        descricao: descricao || null,
        contraparte: fornecedor || null,
        kms: kms || null,
        valor: sinal * Math.abs(t),
        valor_sem_iva: s == null ? null : sinal * Math.abs(s),
        iva: s == null ? null : sinal * Math.abs(t - s),
        comprovativo,
      });
    } catch (e) {
      toast.error(`Erro ao registar: ${errorMessage(e)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-primary/40 bg-muted/30 p-3">
      <Field label="Tipo">
        <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {[...TIPOS_CUSTO, ...TIPOS_RECEITA].map((t) => (
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
          Cancelar
        </Button>
        <Button type="button" disabled={busy || sending} onClick={submit}>
          {sending ? 'A guardar…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}
