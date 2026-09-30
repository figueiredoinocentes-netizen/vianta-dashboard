import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { CreativeMetrics } from '@/types/creativeQuality';
import { cn } from '@/lib/utils';

interface CreativeQualityTableProps {
  metrics: CreativeMetrics[];
  isLoading?: boolean;
}

export const CreativeQualityTable = ({ metrics, isLoading = false }: CreativeQualityTableProps) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (metrics.length === 0) {
    return <div className="text-sm text-muted-foreground py-4">Sem dados disponíveis.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ad Set</TableHead>
          <TableHead>Criativo</TableHead>
          <TableHead className="text-right">Leads</TableHead>
          <TableHead className="text-right">SQLs</TableHead>
          <TableHead className="text-right">Taxa L→SQL</TableHead>
          <TableHead className="text-right">Fechos</TableHead>
          <TableHead className="text-right">Taxa SQL→Fecho</TableHead>
          <TableHead className="text-right">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {metrics.map((metric) => (
          <TableRow key={`${metric.adSet}-${metric.criativo}`} className="hover:bg-muted/30">
            <TableCell className="font-medium text-sm">{metric.adSet}</TableCell>
            <TableCell className="text-sm">{metric.criativo}</TableCell>
            <TableCell className="text-right font-medium">{metric.totalLeads}</TableCell>
            <TableCell className="text-right font-medium">{metric.totalSQLs}</TableCell>
            <TableCell className="text-right">{metric.taxaLeadSQL.toFixed(1)}%</TableCell>
            <TableCell className="text-right font-medium">{metric.totalFechos}</TableCell>
            <TableCell className="text-right">
              {metric.taxaSQLFecho !== null ? `${metric.taxaSQLFecho.toFixed(1)}%` : '—'}
            </TableCell>
            <TableCell className="text-right">
              <Badge
                variant={metric.statusMaturacao === 'maduro' ? 'default' : 'outline'}
                className="text-xs"
              >
                {metric.statusMaturacao === 'maduro' ? 'Maduro' : 'Em maturação'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default CreativeQualityTable;
