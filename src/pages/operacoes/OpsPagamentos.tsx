import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BADGE_CLASS } from '@/lib/operacoes/constants';
import { cn } from '@/lib/utils';
import { useMotoristas, usePagamentos } from '@/hooks/useOperacoes';
import { useOps } from '@/components/operacoes/OpsContext';
import { EmptyState, ErrorBox, OpsHeader } from '@/components/operacoes/shared';

// Reaproveita as cores dos badges de estado da viatura.
function estadoClass(estado: string | null) {
  if (estado === 'Pago') return BADGE_CLASS.Alugado;
  if (estado === 'Pendente') return BADGE_CLASS.Inativo;
  return BADGE_CLASS['Manutenção'];
}

export default function OpsPagamentos() {
  const { openNovaViatura } = useOps();
  const { data: pagamentos = [], isLoading, isError, error } = usePagamentos();
  const { data: motoristas = [] } = useMotoristas();
  const byId = new Map(motoristas.map((m) => [m.id, m]));

  return (
    <>
      <OpsHeader
        title="💰 Pagamentos"
        count={pagamentos.length}
        newLabel="Nova Viatura"
        onNew={openNovaViatura}
        showSearch={false}
      />
      {isError ? (
        <ErrorBox text={`Erro ao carregar pagamentos: ${(error as Error).message}`} />
      ) : isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !pagamentos.length ? (
        <EmptyState icon="💰" text="Sem pagamentos registados" />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motorista</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Total Bruto</TableHead>
                <TableHead>Aluguer</TableHead>
                <TableHead>Taxa Admin</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Líquido</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Data Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagamentos.map((p) => {
                const mot = p.motorista_id != null ? byId.get(p.motorista_id) : undefined;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold">
                      {mot ? mot.nome : `#${p.motorista_id ?? '?'}`}
                    </TableCell>
                    <TableCell className="text-xs">{mot?.email || ''}</TableCell>
                    <TableCell>{mot?.tipo || ''}</TableCell>
                    <TableCell>€{p.total_bruto || '0'}</TableCell>
                    <TableCell>€{p.aluguer || '0'}</TableCell>
                    <TableCell>€{p.taxa_admin || '0'}</TableCell>
                    <TableCell>€{p.iva || '0'}</TableCell>
                    <TableCell className="font-semibold">€{p.liquidio || '0'}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-block rounded px-2 py-0.5 text-[11px] font-medium',
                          estadoClass(p.estado),
                        )}
                      >
                        {p.estado}
                      </span>
                    </TableCell>
                    <TableCell>{p.data_pagamento || ''}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
