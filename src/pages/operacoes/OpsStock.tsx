import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { matchesSearch } from '@/lib/operacoes/constants';
import { useCarros } from '@/hooks/useOperacoes';
import { useOps } from '@/components/operacoes/OpsContext';
import { EmptyState, ErrorBox, OpsHeader, StatusSelect, hideCols } from '@/components/operacoes/shared';

const STOCK_STATES = ['Para Venda', 'Para Aluguer', 'Manutenção', 'Em Preparação'];

export default function OpsStock() {
  const { search, openVehicle, openNovaViatura } = useOps();
  const { data: carros = [], isLoading, isError } = useCarros();
  const rank = (estado: string | null) =>
    estado === 'Em Preparação' ? 2 : estado === 'Manutenção' ? 1 : 0;
  // Manutenção e Preparação aparecem sempre em último (Manutenção antes de Preparação).
  const lista = carros
    .filter((v) => STOCK_STATES.includes(v.estado || ''))
    .filter((v) => matchesSearch(search, v))
    .sort((a, b) => rank(a.estado) - rank(b.estado));

  return (
    <>
      <OpsHeader
        title="🏪 Stock"
        count={lista.length}
        newLabel="Nova Viatura"
        onNew={openNovaViatura}
      />
      {isError ? (
        <ErrorBox text="Erro ao carregar o stock." />
      ) : isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !lista.length ? (
        <EmptyState icon="🏪" text="Nenhum carro em stock" />
      ) : (
        <div className={`rounded-xl border border-border bg-card ${hideCols(3, 4, 5, 7)}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matrícula</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>KMs</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Preço Venda</TableHead>
                <TableHead>Aluguer/Sem</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((v) => {
                const emPrep = v.estado === 'Em Preparação';
                const emMaint = v.estado === 'Manutenção';
                return (
                  <TableRow
                    key={v.id}
                    className={cn('cursor-pointer', emPrep && 'opacity-75', emMaint && 'opacity-70')}
                    onClick={() => openVehicle(v.id)}
                  >
                    <TableCell className="font-semibold">{v.matricula || '-'}</TableCell>
                    <TableCell>
                      {emPrep && '🔧 '}
                      {emMaint && '🛠️ '}
                      {v.marca_modelo || ''}
                    </TableCell>
                    <TableCell>{v.ano || ''}</TableCell>
                    <TableCell>{v.kms_atuais || '-'}</TableCell>
                    <TableCell className="text-xs">{v.proprietario || ''}</TableCell>
                    <TableCell>{v.preco_venda ? `${v.preco_venda}€` : '-'}</TableCell>
                    <TableCell>
                      {v.valor_aluguer_semanal ? `${v.valor_aluguer_semanal}€` : '-'}
                    </TableCell>
                    <TableCell>
                      <StatusSelect carro={v} />
                    </TableCell>
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
