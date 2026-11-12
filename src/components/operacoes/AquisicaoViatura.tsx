import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useFinanceiro, useUpdateCarroField, errorMessage } from '@/hooks/useOperacoes';
import { eur } from '@/lib/operacoes/custos';
import type { Carro, Movimento } from '@/lib/operacoes/types';
import { valorSemIva } from '@/lib/financeiro';
import { FaturaThumb, FaturaViewer } from '@/components/financeiro/FaturaPreview';
import { CamposFaturaCompra } from '@/components/financeiro/FaturaCompra';
import {
  FATURA_COMPRA_VAZIA,
  registarFaturaCompra,
  validarFaturaCompra,
  type FaturaCompraValores,
} from '@/lib/faturaCompra';
import { Field, NativeSelect } from './shared';
import { nomeCarro } from '@/lib/operacoes/identidadeViatura';

const dataPt = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');

/**
 * Secção "Aquisição" na ficha da viatura: Compra (com a fatura de compra do Financeiro)
 * ou Consignação. O campo `aquisicao` grava com o resto da ficha ("Guardar Alterações");
 * a fatura regista-se logo aqui.
 */
export function AquisicaoViatura({
  carro,
  aquisicao,
  gestao,
  onAquisicao,
  onPrecoCompra,
}: {
  carro: Carro;
  aquisicao: string;
  gestao: string;
  onAquisicao: (v: string) => void;
  /** a fatura registada passou a ser o preço de compra (para o formulário não o voltar a escrever por cima) */
  onPrecoCompra: (v: string) => void;
}) {
  const qc = useQueryClient();
  const update = useUpdateCarroField();
  const { data: movs = [] } = useFinanceiro();
  const compras = movs.filter((m) => m.carro_id === carro.id && m.tipo === 'Compra');

  const [ver, setVer] = useState<Movimento | null>(null);
  const [aberto, setAberto] = useState(false);
  const [valores, setValores] = useState<FaturaCompraValores>(FATURA_COMPRA_VAZIA);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function registar() {
    const erro = validarFaturaCompra(valores, file);
    if (erro) return toast.error(erro);
    setSaving(true);
    try {
      const semIva = await registarFaturaCompra({
        carroId: carro.id,
        descricao: `Compra da viatura ${[carro.matricula, nomeCarro(carro)].filter(Boolean).join(' · ')}`,
        valores,
        file: file!,
        gestao,
      });
      await update(carro, 'preco_compra', String(semIva));
      if (carro.aquisicao !== 'Compra') await update(carro, 'aquisicao', 'Compra');
      onPrecoCompra(String(semIva));
      onAquisicao('Compra');
      await qc.invalidateQueries({ queryKey: ['central', 'financeiro'] });
      toast.success('Fatura de compra registada no Financeiro');
      setAberto(false);
      setValores(FATURA_COMPRA_VAZIA);
      setFile(null);
    } catch (e) {
      toast.error(`Erro ao registar a fatura: ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
      <Field label="Aquisição">
        <NativeSelect value={aquisicao} onChange={(e) => onAquisicao(e.target.value)}>
          <option value="">— por definir —</option>
          <option value="Compra">Compra (com fatura de compra)</option>
          <option value="Consignação">Consignação</option>
        </NativeSelect>
      </Field>

      {compras.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-md border border-border bg-background/40 p-2">
          {m.ficheiro ? (
            <FaturaThumb path={m.ficheiro} nome={m.ficheiro_nome} onClick={() => setVer(m)} />
          ) : (
            <div className="flex h-16 w-12 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted-foreground">
              sem PDF
            </div>
          )}
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-semibold text-foreground">
              Fatura de compra {m.n_documento ? `· ${m.n_documento}` : ''}
            </div>
            <div className="text-muted-foreground">
              {[dataPt(m.data), m.contraparte, m.centro_custo].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-0.5 text-foreground">
              {eur(valorSemIva(m).valor)} s/ IVA
              {m.iva != null && m.iva !== '' && <span className="text-muted-foreground"> · total {eur(Math.abs(Number(m.valor) || 0))}</span>}
            </div>
          </div>
          {m.ficheiro && (
            <Button type="button" variant="outline" size="sm" onClick={() => setVer(m)}>
              Ver fatura
            </Button>
          )}
        </div>
      ))}

      {aquisicao === 'Consignação' && !compras.length && (
        <p className="text-xs text-muted-foreground">Viatura em consignação — sem fatura de compra.</p>
      )}

      {aquisicao === 'Compra' && !compras.length && !aberto && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-amber-500">Ainda não há fatura de compra registada para esta viatura.</p>
          <Button type="button" size="sm" onClick={() => setAberto(true)}>
            Anexar fatura de compra
          </Button>
        </div>
      )}

      {aberto && (
        <div className="space-y-3 rounded-md border border-primary/40 p-3">
          <CamposFaturaCompra valores={valores} onChange={setValores} onFile={setFile} gestao={gestao} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={registar}>
              {saving ? 'A registar…' : 'Registar fatura'}
            </Button>
          </div>
        </div>
      )}

      <FaturaViewer
        path={ver?.ficheiro || null}
        nome={ver?.ficheiro_nome}
        titulo={ver ? ['Fatura de compra', ver.n_documento, ver.contraparte].filter(Boolean).join(' · ') : undefined}
        onClose={() => setVer(null)}
      />
    </div>
  );
}
