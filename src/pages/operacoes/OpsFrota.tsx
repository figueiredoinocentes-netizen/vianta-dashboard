import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { matchesSearch } from '@/lib/operacoes/constants';
import { useCarros } from '@/hooks/useOperacoes';
import { useOps } from '@/components/operacoes/OpsContext';
import { EmptyState, ErrorBox, OpsHeader, StatusSelect, hideCols } from '@/components/operacoes/shared';

export default function OpsFrota() {
  const { search, openVehicle, openNovaViatura } = useOps();
  const { data: carros = [], isLoading, isError } = useCarros();
  const lista = carros
    .filter((v) => v.estado === 'Alugado' && v.tipo_gestao !== 'Slot')
    .filter((v) => matchesSearch(search, v));

  return (
    <>
      <OpsHeader
        title="🚗 Frota Ativa"
        count={lista.length}
        newLabel="Nova Viatura"
        onNew={openNovaViatura}
      />
      {isError ? (
        <ErrorBox text="Erro ao carregar a frota." />
      ) : isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !lista.length ? (
        <EmptyState icon="🚗" text="Nenhum carro alugado de momento" />
      ) : (
        <div className={`rounded-xl border border-border bg-card ${hideCols(4, 5, 6)}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matrícula</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Gestão</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Aluguer/Sem</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => openVehicle(v.id)}>
                  <TableCell className="font-semibold">{v.matricula || '-'}</TableCell>
                  <TableCell>{v.marca_modelo || ''}</TableCell>
                  <TableCell>{v.motorista_atual || '-'}</TableCell>
                  <TableCell className="text-xs">{v.tipo_gestao || ''}</TableCell>
                  <TableCell className="text-xs">{v.proprietario || ''}</TableCell>
                  <TableCell>{v.valor_aluguer_semanal ? `${v.valor_aluguer_semanal}€` : '-'}</TableCell>
                  <TableCell>
                    <StatusSelect carro={v} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
