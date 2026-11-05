// Campos da fatura de compra de uma viatura (partilhados: Nova Viatura e ficha da viatura).
import { Input } from '@/components/ui/input';
import { Field, NativeSelect } from '@/components/operacoes/shared';
import { CENTROS_CUSTO } from '@/lib/financeiro';
import { centroPorGestao, hoje, type FaturaCompraValores } from '@/lib/faturaCompra';

/** Os campos da fatura de compra (sem <form>, pode viver dentro de outro formulário). */
export function CamposFaturaCompra({
  valores,
  onChange,
  onFile,
  gestao,
}: {
  valores: FaturaCompraValores;
  onChange: (v: FaturaCompraValores) => void;
  onFile: (f: File | null) => void;
  gestao?: string | null;
}) {
  const set = (k: keyof FaturaCompraValores, x: string) => onChange({ ...valores, [k]: x });
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      // Enter num campo não deve submeter o formulário à volta.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
      }}
    >
      <Field label="Fatura (PDF ou imagem)" required className="sm:col-span-2">
        <Input type="file" accept="application/pdf,image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} />
      </Field>
      <Field label="Nº documento">
        <Input value={valores.num} onChange={(e) => set('num', e.target.value)} placeholder="ex.: FT 2026/123" />
      </Field>
      <Field label="Data da fatura">
        <Input type="date" value={valores.data || hoje()} onChange={(e) => set('data', e.target.value)} />
      </Field>
      <Field label="Fornecedor" className="sm:col-span-2">
        <Input value={valores.fornecedor} onChange={(e) => set('fornecedor', e.target.value)} />
      </Field>
      <Field label="Valor s/ IVA (€)" required>
        <Input inputMode="decimal" value={valores.semIva} onChange={(e) => set('semIva', e.target.value)} />
      </Field>
      <Field label="IVA (€)">
        <Input
          inputMode="decimal"
          value={valores.iva}
          onChange={(e) => set('iva', e.target.value)}
          placeholder="0 se regime da margem"
        />
      </Field>
      <Field label="Centro de custo" className="sm:col-span-2">
        <NativeSelect value={valores.centro || centroPorGestao(gestao)} onChange={(e) => set('centro', e.target.value)}>
          {CENTROS_CUSTO.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </NativeSelect>
      </Field>
      <p className="text-[11px] text-muted-foreground sm:col-span-2">
        O valor s/ IVA passa a ser o preço de compra da viatura.
      </p>
    </div>
  );
}
