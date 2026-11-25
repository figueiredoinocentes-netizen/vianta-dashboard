import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, useCarros, useFinanceiro, useRefreshOperacoes } from '@/hooks/useOperacoes';
import { MAX_FATURA_MB, updateCentralField, uploadFatura } from '@/lib/operacoes/central';
import { eur, toNum } from '@/lib/operacoes/custos';
import type { Carro, Movimento } from '@/lib/operacoes/types';
import { useLeads } from '@/lib/leads';
import { nomeCarro } from '@/lib/operacoes/identidadeViatura';

const dataPt = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Formulário de validação: associa a fatura de venda ao movimento provisório e fecha-o. */
function Validar({ m, onFechar }: { m: Movimento; onFechar: () => void }) {
  const refresh = useRefreshOperacoes();
  const [num, setNum] = useState(m.n_documento || '');
  const [total, setTotal] = useState(String(m.valor ?? ''));
  const [semIva, setSemIva] = useState(m.valor_sem_iva == null ? '' : String(m.valor_sem_iva));
  const [file, setFile] = useState<File | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  async function validar() {
    if (!num.trim()) return toast.error('Indique o nº da fatura de venda.');
    if (!file && !m.ficheiro) return toast.error('Anexe a fatura de venda (PDF).');
    if (file && file.size > MAX_FATURA_MB * 1024 * 1024) return toast.error(`A fatura tem mais de ${MAX_FATURA_MB} MB.`);
    const t = round2(toNum(total));
    const s = round2(toNum(semIva));
    if (!t || !s) return toast.error('Indique os valores c/ e s/ IVA da fatura.');
    setAGuardar(true);
    try {
      const campos: [string, unknown][] = [
        ['n_documento', num.trim()],
        ['valor', t],
        ['valor_sem_iva', s],
        ['iva', round2(t - s)],
      ];
      if (file) {
        campos.push(['ficheiro', await uploadFatura(file, m.data || undefined)]);
        campos.push(['ficheiro_nome', file.name]);
      }
      campos.push(['validado_em', new Date().toISOString()], ['estado_validacao', 'validado']);
      for (const [campo, valor] of campos) await updateCentralField('financeiro', m.id, campo, valor);
      refresh();
      toast.success('Venda validada com a fatura');
      onFechar();
    } catch (e) {
      toast.error(`Erro ao validar: ${errorMessage(e)}`);
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <div className="mt-2 grid gap-2 rounded-md border border-primary/40 p-2 sm:grid-cols-4">
      <Input placeholder="Nº da fatura" value={num} onChange={(e) => setNum(e.target.value)} />
      <Input inputMode="decimal" placeholder="Total c/ IVA" value={total} onChange={(e) => setTotal(e.target.value)} />
      <Input inputMode="decimal" placeholder="Valor s/ IVA" value={semIva} onChange={(e) => setSemIva(e.target.value)} />
      <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <div className="flex justify-end gap-2 sm:col-span-4">
        <Button type="button" variant="outline" size="sm" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={aGuardar} onClick={() => void validar()}>
          {aGuardar ? 'A validar…' : 'Validar venda'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Vendas de viaturas no Financeiro: registadas no fecho do negócio como provisórias,
 * validadas no fecho do mês quando se associa a fatura de venda.
 */
export function VendasViaturas() {
  const { data: movs = [] } = useFinanceiro();
  const { data: carros = [] } = useCarros();
  const leads = useLeads();
  const [aValidar, setAValidar] = useState<number | null>(null);
  const [verValidadas, setVerValidadas] = useState(false);

  const carroPorId = useMemo(() => new Map(carros.map((c) => [c.id, c])), [carros]);
  const leadPorId = useMemo(() => new Map((leads.data || []).map((l) => [l.id, l])), [leads.data]);
  const vendas = useMemo(
    () =>
      movs
        .filter((m) => m.tipo === 'Venda')
        .sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.id - a.id),
    [movs],
  );
  const porValidar = vendas.filter((m) => m.estado_validacao !== 'validado');
  const lista = verValidadas ? vendas : porValidar;

  if (!vendas.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Vendas de viaturas</div>
          <div className="text-[11px] text-muted-foreground">
            {porValidar.length} por validar · associar a fatura de venda no fecho do mês
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={verValidadas} onChange={(e) => setVerValidadas(e.target.checked)} />
          mostrar também as validadas
        </label>
      </div>
      {!lista.length ? (
        <p className="text-xs text-muted-foreground">Todas as vendas estão validadas.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((m) => {
            const c: Carro | undefined = m.carro_id != null ? carroPorId.get(m.carro_id) : undefined;
            const lead = m.ghl_lead_id ? leadPorId.get(m.ghl_lead_id) : undefined;
            const margem = c?.margem_bruta == null || c.margem_bruta === '' ? null : Number(c.margem_bruta);
            const validada = m.estado_validacao === 'validado';
            return (
              <div key={m.id} className="rounded-lg border border-border p-2 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {[c?.matricula, c ? nomeCarro(c) : null].filter(Boolean).join(' · ') || 'Viatura'}
                    </div>
                    <div className="text-muted-foreground">
                      {dataPt(m.data)} · {m.contraparte || 'cliente por identificar'}
                      {lead && ` · ${[lead.campanha, lead.adset, lead.criativo].filter(Boolean).join(' / ')}`}
                      {m.ghl_lead_id && !lead && ' · lead ligada'}
                      {!m.ghl_lead_id && ' · sem lead do CRM'}
                    </div>
                    {validada && (
                      <div className="text-muted-foreground">
                        Fatura {m.n_documento} · validada a {dataPt(m.validado_em || null)}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{eur(toNum(m.valor))} c/ IVA</div>
                    <div className="text-muted-foreground">
                      {m.valor_sem_iva != null ? `${eur(toNum(m.valor_sem_iva))} s/ IVA` : 's/ IVA por indicar'}
                    </div>
                    <div className={margem == null ? 'text-amber-500' : margem < 0 ? 'text-destructive' : 'text-emerald-500'}>
                      Margem bruta: {margem == null ? '— (falta % investidor)' : eur(margem)}
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span
                    className={
                      'rounded px-1.5 py-0.5 text-[10px] ' +
                      (validada ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500')
                    }
                  >
                    {validada ? 'Validada' : 'Provisória'}
                  </span>
                  {!validada && aValidar !== m.id && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setAValidar(m.id)}>
                      Associar fatura e validar
                    </Button>
                  )}
                </div>
                {aValidar === m.id && <Validar m={m} onFechar={() => setAValidar(null)} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
