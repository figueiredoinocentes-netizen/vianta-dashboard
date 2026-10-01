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
import { useCarros, useInvestidores } from '@/hooks/useOperacoes';
import { useOps } from '@/components/operacoes/OpsContext';
import { EmptyState, ErrorBox, OpsHeader, hideCols } from '@/components/operacoes/shared';

export default function OpsInvestidores() {
  const { search, openInvestidor } = useOps();
  const { data: investidores = [], isLoading, isError } = useInvestidores();
  const { data: carros = [] } = useCarros();
  const lista = investidores.filter((i) => matchesSearch(search, i));

  return (
    <>
      <OpsHeader
        title="🤝 Investidores"
        count={lista.length}
        newLabel="Novo Investidor"
        onNew={() => openInvestidor()}
      />
      {isError ? (
        <ErrorBox text="Erro ao carregar os investidores." />
      ) : isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !lista.length ? (
        <EmptyState icon="🤝" text="Nenhum investidor registado" />
      ) : (
        <div className={`rounded-xl border border-border bg-card ${hideCols(2, 4, 5)}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>IBAN</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Viaturas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => openInvestidor(i.id)}
                      className="font-semibold underline decoration-dotted underline-offset-4 hover:text-primary"
                    >
                      {i.nome}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">{i.email || '-'}</TableCell>
                  <TableCell className="text-xs">{i.telefone || '-'}</TableCell>
                  <TableCell className="text-xs">{i.iban || '-'}</TableCell>
                  <TableCell className="text-xs">{i.nif || '-'}</TableCell>
                  <TableCell>{carros.filter((v) => v.investidor_id === i.id).length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
