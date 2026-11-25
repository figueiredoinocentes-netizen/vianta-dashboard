import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, useCentralWrites, useUpdateCarroField } from '@/hooks/useOperacoes';
import { eur, ivaVenda, toNum } from '@/lib/operacoes/custos';
import type { Carro } from '@/lib/operacoes/types';
import { useProcurarLeads, type Lead } from '@/lib/leads';
import { nomeCarro } from '@/lib/operacoes/identidadeViatura';
import { Field, NativeSelect } from './shared';

const hoje = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Regista a venda da viatura no Financeiro como movimento tipo 'Venda', provisório até se
 * associar a fatura no fecho do mês. Liga a venda à lead da DB Leads Log (ghl_lead_id) e
 * passa a viatura a Vendido com a data de venda.
 */
export function RegistarVenda({ carro, onFechar }: { carro: Carro; onFechar: () => void }) {
  const { create } = useCentralWrites('financeiro');
  const update = useUpdateCarroField();
  const [data, setData] = useState(carro.data_venda?.slice(0, 10) || hoje());
  const [total, setTotal] = useState(carro.preco_venda ? String(carro.preco_venda) : '');
  const ivaIni = ivaVenda(carro);
  const [iva, setIva] = useState(ivaIni == null ? '' : String(ivaIni));
  const [procura, setProcura] = useState('');
  const [lead, setLead] = useState<Lead | null>(null);
  const [cliente, setCliente] = useState('');
  const [aGuardar, setAGuardar] = useState(false);

  const t = toNum(total);
  const semIva = iva === '' ? null : round2(t / (1 + Number(iva) / 100));
  const leads = useProcurarLeads(lead ? '' : procura);
  const sugestoes = lead ? [] : leads.data || [];

  async function guardar() {
    if (!t) return toast.error('Indique o valor da venda (c/ IVA).');
    if (iva === '') return toast.error('Escolha o IVA da venda (0% ou 23%).');
    const nome = lead?.nome || cliente.trim();
    if (!nome) return toast.error('Escolha a lead do cliente ou escreva o nome do cliente.');
    setAGuardar(true);
    try {
      await create.mutateAsync({
        carro_id: carro.id,
        data,
        tipo: 'Venda',
        categoria: 'Venda de viatura',
        descricao: `Venda da viatura ${[carro.matricula, nomeCarro(carro)].filter(Boolean).join(' · ')}`,
        contraparte: nome,
        centro_custo: 'Stand',
        valor: round2(t),
        valor_sem_iva: semIva,
        iva: round2(t - (semIva ?? t)),
        ghl_lead_id: lead?.id || null,
        estado_validacao: 'provisorio',
      });
      if (String(carro.iva_venda ?? '') !== iva) await update(carro, 'iva_venda', Number(iva));
      if ((carro.data_venda || '').slice(0, 10) !== data) await update(carro, 'data_venda', data);
      if (carro.estado !== 'Vendido') await update(carro, 'estado', 'Vendido');
      toast.success('Venda registada (provisória até associar a fatura no fecho do mês)');
      onFechar();
    } catch (e) {
      toast.error(`Erro ao registar a venda: ${errorMessage(e)}`);
    } finally {
      setAGuardar(false);
    }
  }

  return (
    // Está dentro do formulário da ficha: Enter aqui não pode guardar a ficha.
    <div
      className="space-y-3 rounded-lg border border-primary/40 p-3"
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
    >
      <div className="text-sm font-semibold">Registar venda</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Data da venda">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Valor da venda (€, c/ IVA)">
          <Input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
        </Field>
        <Field label="IVA da venda">
          <NativeSelect value={iva} onChange={(e) => setIva(e.target.value)}>
            <option value="">— escolher —</option>
            <option value="23">23%</option>
            <option value="0">0%</option>
          </NativeSelect>
          {semIva != null && t > 0 && <p className="mt-1 text-[11px] text-muted-foreground">s/ IVA: {eur(semIva)}</p>}
        </Field>
      </div>

      <Field label="Cliente (lead do CRM)">
        {lead ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
            <div>
              <div className="font-semibold">{lead.nome}</div>
              <div className="text-muted-foreground">
                {[lead.telemovel, lead.data, lead.campanha, lead.criativo].filter(Boolean).join(' · ')}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setLead(null)}>
              Trocar
            </Button>
          </div>
        ) : (
          <>
            <Input
              placeholder="Procurar por nome, email ou telemóvel"
              value={procura}
              onChange={(e) => setProcura(e.target.value)}
            />
            {leads.isError && (
              <p className="mt-1 text-[11px] text-amber-500">{errorMessage(leads.error)}</p>
            )}
            {!!sugestoes.length && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border">
                {sugestoes.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLead(l)}
                    className="block w-full border-b border-border/50 px-2 py-1.5 text-left text-xs last:border-0 hover:bg-muted"
                  >
                    <span className="font-medium">{l.nome || '(sem nome)'}</span>
                    <span className="text-muted-foreground"> · {[l.telemovel, l.data, l.oferta, l.campanha].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Sem lead (cliente que não veio do CRM)? Escreva só o nome:
            </p>
            <Input placeholder="Nome do cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </>
        )}
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={aGuardar} onClick={() => void guardar()}>
          {aGuardar ? 'A registar…' : 'Registar venda'}
        </Button>
      </div>
    </div>
  );
}
