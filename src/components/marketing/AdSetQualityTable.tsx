import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { AdSetQualityRow } from '@/types/adSetQuality';
import { SQL_MATURATION_DAYS } from '@/lib/adSetQuality';
import { cn } from '@/lib/utils';

interface AdSetQualityTableProps {
  rows: AdSetQualityRow[];
  isLoading?: boolean;
  /** true quando a janela de gasto/LP-views é um fallback fixo de 30d, não o período seleccionado na página. */
  usingFallbackWindow?: boolean;
}

export const AdSetQualityTable = ({ rows, isLoading = false, usingFallbackWindow = false }: AdSetQualityTableProps) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground py-4">Sem dados disponíveis.</div>;
  }

  const euro = (v: number | null) => (v !== null ? `€${v.toFixed(0)}` : '—');
  const pct = (v: number | null) => (v !== null ? `${(v * 100).toFixed(1)}%` : '—');

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ad Set</TableHead>
            <TableHead>Criativo(s)</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Gasto{usingFallbackWindow ? ' (30d)' : ''}</TableHead>
            <TableHead className="text-right">Custo/Lead</TableHead>
            <TableHead className="text-right">Taxa NLQ</TableHead>
            <TableHead className="text-right">Custo/NLQ</TableHead>
            <TableHead className="text-right">SQL</TableHead>
            <TableHead className="text-right">Custo/SQL</TableHead>
            <TableHead className="text-right">Pedidos Submetidos</TableHead>
            <TableHead className="text-right">Custo/Pedido</TableHead>
            <TableHead className="text-right">Fechos</TableHead>
            <TableHead className="text-right">Custo/Fecho</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.adSet} className="hover:bg-muted/30">
              <TableCell className="font-medium text-sm">{r.adSet}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={r.criativos.join(', ')}>
                {r.criativos.length > 0 ? r.criativos.join(', ') : '—'}
              </TableCell>
              <TableCell className="text-right">
                <div className="font-medium">{r.totalLeads}</div>
                {r.leadsEmMaturacao > 0 && (
                  <Badge variant="outline" className="text-[10px] mt-1 whitespace-nowrap">
                    {r.leadsEmMaturacao} em maturação
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">{euro(r.gasto)}</TableCell>
              <TableCell className="text-right">{euro(r.custoPorLead)}</TableCell>
              <TableCell className={cn("text-right", r.taxaNLQ === null && "text-muted-foreground")}>{pct(r.taxaNLQ)}</TableCell>
              <TableCell className="text-right">{euro(r.custoPorNLQ)}</TableCell>
              <TableCell className="text-right font-medium">
                <div>{r.totalSQLs}</div>
                {r.sqlImaturoCount > 0 && (
                  <Badge variant="outline" className="text-[10px] mt-1 whitespace-nowrap">
                    +{r.sqlImaturoCount} em maturação
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right font-medium">{euro(r.custoPorSQL)}</TableCell>
              <TableCell className="text-right">{r.submetidas}</TableCell>
              <TableCell className="text-right">{euro(r.custoPorSubmetida)}</TableCell>
              <TableCell className="text-right">{r.fechos}</TableCell>
              <TableCell className="text-right">{euro(r.custoPorFecho)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Leads com menos de {SQL_MATURATION_DAYS} dias desde o registo são excluídas apenas do cálculo de SQL/Custo por SQL (mostradas como "em maturação") — ainda não tiveram tempo suficiente para converter. As restantes métricas (NLQ, Pedidos Submetidos, Fechos) não usam janela de maturação.
        {' '}Gasto vem de dados diários reais do Meta Ads (meta_insights_daily){usingFallbackWindow
          ? ', janela fixa de 30 dias (o período seleccionado não mapeia para uma janela de datas única).'
          : ', na mesma janela do período seleccionado na página.'}
      </p>
    </div>
  );
};

export default AdSetQualityTable;
