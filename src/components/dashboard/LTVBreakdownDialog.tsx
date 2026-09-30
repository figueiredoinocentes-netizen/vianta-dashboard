import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import type { LTVBreakdown } from '@/types/dashboard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown: LTVBreakdown;
}

const LTVBreakdownDialog = ({ open, onOpenChange, breakdown }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Detalhe do Cálculo LTV Médio</DialogTitle>
          <DialogDescription>Valores utilizados no cálculo do Lifetime Value médio.</DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Drivers no cálculo</span>
              <span className="font-medium">{breakdown.driversCount}</span>
            </div>
            <div className="flex justify-between">
              <span>LTV Médio</span>
              <span className="font-medium">€{Math.round(breakdown.ltvMedio).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Tabela por driver */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Drivers ({breakdown.driversCount})
          </h4>
          {breakdown.driversList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Nome</TableHead>
                  <TableHead className="h-8 text-xs text-right">Ticket</TableHead>
                  <TableHead className="h-8 text-xs">Fecho</TableHead>
                  <TableHead className="h-8 text-xs">Saída</TableHead>
                  <TableHead className="h-8 text-xs text-right">Meses</TableHead>
                  <TableHead className="h-8 text-xs text-right">LTV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.driversList.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-1.5 text-sm">{d.nome}</TableCell>
                    <TableCell className="py-1.5 text-sm text-right">€{d.ticket}</TableCell>
                    <TableCell className="py-1.5 text-sm">{d.dataFecho}</TableCell>
                    <TableCell className="py-1.5 text-sm">{d.dataSaida || 'Ativo'}</TableCell>
                    <TableCell className="py-1.5 text-sm text-right">{d.mesesAtivos}</TableCell>
                    <TableCell className="py-1.5 text-sm text-right font-medium">€{d.ltvIndividual.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Sem drivers com ticket e data de fecho no período.</p>
          )}
        </div>

        {/* Resultado */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resultado</h4>
          <p className="text-xs text-muted-foreground">Soma dos LTVs individuais / Número de drivers</p>
          <div className="flex justify-between items-baseline">
            <span className="text-sm">€{breakdown.somaLTV.toLocaleString()} / {breakdown.driversCount}</span>
            <span className="text-xl font-display font-bold text-primary">= €{Math.round(breakdown.ltvMedio).toLocaleString()}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LTVBreakdownDialog;
