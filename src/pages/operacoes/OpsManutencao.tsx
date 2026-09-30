import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { destinoDepoisDePreparacao, matchesSearch } from '@/lib/operacoes/constants';
import { useCarros, useUpdateCarroField } from '@/hooks/useOperacoes';
import { useOps } from '@/components/operacoes/OpsContext';
import { EmptyState, ErrorBox, OpsHeader, StatusSelect } from '@/components/operacoes/shared';

export default function OpsManutencao() {
  const { search, openVehicle, openNovaViatura } = useOps();
  const { data: carros = [], isLoading, isError } = useCarros();
  const update = useUpdateCarroField();
  const lista = carros.filter((v) => v.estado === 'Manutenção').filter((v) => matchesSearch(search, v));

  return (
    <>
      <OpsHeader
        title="🔧 Manutenções"
        count={lista.length}
        newLabel="Nova Viatura"
        onNew={openNovaViatura}
      />
      {isError ? (
        <ErrorBox text="Erro ao carregar as manutenções." />
      ) : isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !lista.length ? (
        <EmptyState icon="🔧" text="Nenhum carro em manutenção" />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matrícula</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => openVehicle(v.id)}>
                  <TableCell className="font-semibold">{v.matricula || '-'}</TableCell>
                  <TableCell>{v.marca_modelo || ''}</TableCell>
                  <TableCell className="text-xs">{v.proprietario || ''}</TableCell>
                  <TableCell>
                    <StatusSelect carro={v} />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        update(v, 'estado', destinoDepoisDePreparacao(v));
                      }}
                    >
                      Marcar Disponível
                    </Button>
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
