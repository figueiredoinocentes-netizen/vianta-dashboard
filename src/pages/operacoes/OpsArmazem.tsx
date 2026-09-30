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
import { useArmazem } from '@/hooks/useOperacoes';
import { useOps } from '@/components/operacoes/OpsContext';
import { EmptyState, ErrorBox, OpsHeader } from '@/components/operacoes/shared';

export default function OpsArmazem() {
  const { search, openNovoItem } = useOps();
  const { data: itens = [], isLoading, isError } = useArmazem();
  const lista = itens.filter((i) => matchesSearch(search, i));

  return (
    <>
      <OpsHeader title="📦 Armazém" count={lista.length} newLabel="Novo Item" onNew={openNovoItem} />
      {isError ? (
        <ErrorBox text="Erro ao carregar o armazém." />
      ) : isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !lista.length ? (
        <EmptyState icon="📦" text="Nenhum item no armazém" />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Mínimo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Última Compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((i) => {
                const stock = parseInt(String(i.stock_atual ?? '0'));
                const minimo = parseInt(String(i.stock_minimo ?? '0'));
                const cor =
                  stock < minimo ? 'text-red-500' : stock <= minimo ? 'text-amber-500' : 'text-green-500';
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-semibold">{i.item || ''}</TableCell>
                    <TableCell>{i.categoria || ''}</TableCell>
                    <TableCell className={cn('font-semibold', cor)}>{i.stock_atual ?? '0'}</TableCell>
                    <TableCell>{i.stock_minimo ?? '0'}</TableCell>
                    <TableCell>{i.unidade || ''}</TableCell>
                    <TableCell>{i.fornecedor || ''}</TableCell>
                    <TableCell>{i.ultima_compra || ''}</TableCell>
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
