import { Skeleton } from '@/components/ui/skeleton';
import { imprimirFichaComercial } from '@/lib/operacoes/fichaComercial';
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
import { NomeViatura } from '@/components/operacoes/NomeViatura';
import { useCarros } from '@/hooks/useOperacoes';
import { useOps } from '@/components/operacoes/OpsContext';
import { EmptyState, ErrorBox, OpsHeader, StatusSelect, hideCols } from '@/components/operacoes/shared';
import { camposEmFalta } from '@/lib/operacoes/estadoRequisitos';

const STOCK_STATES = ['Para Venda', 'Para Aluguer', 'Para Venda e Aluguer', 'Manutenção', 'Em Preparação'];

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
  const incompletos = lista.filter((v) => camposEmFalta(v, v.estado).length > 0);

  return (
    <>
      <OpsHeader
        title="🏪 Stock"
        count={lista.length}
        newLabel="Nova Viatura"
        onNew={openNovaViatura}
      />
      {!isLoading && !isError && incompletos.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          ⚠️ {incompletos.length === 1 ? '1 viatura tem' : `${incompletos.length} viaturas têm`} a Ficha comercial incompleta. As linhas assinaladas mostram o que falta.
        </div>
      )}
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
                <TableHead>Carro</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>KMs</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Preço Venda</TableHead>
                <TableHead>Aluguer/Sem</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((v) => {
                const emPrep = v.estado === 'Em Preparação';
                const emMaint = v.estado === 'Manutenção';
                const faltam = camposEmFalta(v, v.estado);
                return (
                  <TableRow
                    key={v.id}
                    className={cn('cursor-pointer', emPrep && 'opacity-75', emMaint && 'opacity-70')}
                    onClick={() => openVehicle(v.id)}
                  >
                    <TableCell className="font-semibold">{v.matricula || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {emPrep && <span>🔧</span>}{emMaint && <span>🛠️</span>}
                        <NomeViatura carro={v} fallback="-" />
                        {!!faltam.length && (
                          <button
                            type="button"
                            title={`Ficha comercial incompleta: ${faltam.map((f) => f.label).join(', ')}`}
                            aria-label={`Ficha comercial incompleta: ${faltam.map((f) => f.label).join(', ')}`}
                            className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/25"
                            onClick={(e) => { e.stopPropagation(); openVehicle(v.id, 'ficha'); }}
                          >
                            ⚠ Ficha incompleta
                          </button>
                        )}
                      </div>
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
                    <TableCell>
                      <button
                        type="button"
                        title="Imprimir ficha comercial"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-xs text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); imprimirFichaComercial(v); }}
                      >
                        🖨️
                      </button>
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
