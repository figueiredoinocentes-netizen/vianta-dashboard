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
import { useCarros, useOcorrencias, useUpdateCarroField } from '@/hooks/useOperacoes';
import { emAberto, ePreparacao, gravidadeClass } from '@/lib/operacoes/trabalhos';
import { useOps } from '@/components/operacoes/OpsContext';
import { EmptyState, ErrorBox, OpsHeader, StatusSelect, hideCols } from '@/components/operacoes/shared';

export default function OpsManutencao() {
  const { search, openVehicle, openNovaViatura } = useOps();
  const { data: carros = [], isLoading, isError } = useCarros();
  const update = useUpdateCarroField();
  const { data: ocorrencias = [] } = useOcorrencias();
  const pendentes = ocorrencias
    .filter((o) => emAberto(o) && !ePreparacao(o))
    .map((o) => ({ o, carro: carros.find((c) => c.id === o.carro_id) }))
    .filter((x) => x.carro && matchesSearch(search, x.carro))
    .sort((a, b) => (b.o.gravidade === 'Alta' ? 1 : 0) - (a.o.gravidade === 'Alta' ? 1 : 0));
  const lista = carros.filter((v) => v.estado === 'Manutenção').filter((v) => matchesSearch(search, v));

  return (
    <>
      <OpsHeader
        title="🔧 Manutenções"
        count={lista.length}
        newLabel="Nova Viatura"
        onNew={openNovaViatura}
      />
      {!!pendentes.length && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold">
            Ocorrências por resolver <span className="text-muted-foreground">({pendentes.length})</span>
          </div>
          <div className="flex flex-col gap-2">
            {pendentes.map(({ o, carro }) => (
              <button
                key={o.id}
                type="button"
                onClick={() => openVehicle(o.carro_id)}
                className="flex items-center gap-3 rounded-lg border border-border p-2 text-left transition hover:border-primary"
              >
                {o.fotos?.[0] ? (
                  <img src={o.fotos[0]} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-md bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {carro?.matricula} · {carro?.marca_modelo}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {o.tipo}: {o.descricao || 'sem descrição'}
                  </div>
                </div>
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${gravidadeClass(o.gravidade)}`}>{o.gravidade}</span>
                <span className="text-[11px] text-muted-foreground">{o.estado}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {isError ? (
        <ErrorBox text="Erro ao carregar as manutenções." />
      ) : isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !lista.length ? (
        <EmptyState icon="🔧" text="Nenhum carro em manutenção" />
      ) : (
        <div className={`rounded-xl border border-border bg-card ${hideCols(3)}`}>
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
