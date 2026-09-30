import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import type { ChurnBreakdown } from '@/types/dashboard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown: ChurnBreakdown;
}

const ChurnBreakdownDialog = ({ open, onOpenChange, breakdown }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Detalhe do Cálculo Churn</DialogTitle>
          <DialogDescription>Valores utilizados no cálculo da taxa de churn.</DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Total de drivers no período</span>
              <span className="font-medium">{breakdown.totalDrivers}</span>
            </div>
            <div className="flex justify-between">
              <span>Drivers que saíram</span>
              <span className="font-medium">{breakdown.churnedDrivers}</span>
            </div>
          </div>
        </div>

        {/* Lista de saídas */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Drivers que saíram ({breakdown.churnedDrivers})
          </h4>
          {breakdown.churnedList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Nome</TableHead>
                  <TableHead className="h-8 text-xs">Oferta</TableHead>
                  <TableHead className="h-8 text-xs">Fonte</TableHead>
                  <TableHead className="h-8 text-xs text-right">Data Saída</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.churnedList.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-1.5 text-sm">{d.nome}</TableCell>
                    <TableCell className="py-1.5 text-sm">{d.tipoOferta}</TableCell>
                    <TableCell className="py-1.5 text-sm">{d.fonte}</TableCell>
                    <TableCell className="py-1.5 text-sm text-right">{d.dataSaida}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Sem saídas no período selecionado.</p>
          )}
        </div>

        {/* Resultado */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resultado</h4>
          <p className="text-xs text-muted-foreground">Churned / Total Drivers × 100</p>
          <div className="flex justify-between items-baseline">
            <span className="text-sm">{breakdown.churnedDrivers} / {breakdown.totalDrivers} × 100</span>
            <span className="text-xl font-display font-bold text-primary">= {breakdown.taxaChurn.toFixed(1)}%</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChurnBreakdownDialog;
