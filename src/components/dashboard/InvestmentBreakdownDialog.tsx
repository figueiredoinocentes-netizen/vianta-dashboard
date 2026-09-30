import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import type { InvestmentBreakdown } from '@/types/dashboard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown: InvestmentBreakdown;
}

const InvestmentBreakdownDialog = ({ open, onOpenChange, breakdown }: Props) => {
  const fmt = (v: number) => `€${Math.round(v).toLocaleString()}`;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Detalhe do Investimento</DialogTitle>
          <DialogDescription>Composição do investimento total no período selecionado.</DialogDescription>
        </DialogHeader>

        {/* Ads */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investimento Ads</h4>
          {breakdown.adsCampaigns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Campanha</TableHead>
                  <TableHead className="h-8 text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.adsCampaigns.map(c => (
                  <TableRow key={c.campanha}>
                    <TableCell className="py-1.5 text-sm">{c.campanha}</TableCell>
                    <TableCell className="py-1.5 text-sm text-right font-medium">{fmt(c.valor)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2">
                  <TableCell className="py-1.5 text-sm font-semibold">Total Ads</TableCell>
                  <TableCell className="py-1.5 text-sm text-right font-semibold">{fmt(breakdown.adsTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Sem investimento em ads no período.</p>
          )}
        </div>

        {/* Comercial */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custo Comercial</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Comercial total</span>
              <span className="font-medium">{fmt(breakdown.comercialTotal)}</span>
            </div>
            {breakdown.comercialProporcional !== null && breakdown.ratioFB !== null && (
              <>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Rácio FB ({breakdown.conversoesFBOferta}/{breakdown.conversoesFBTotal})</span>
                  <span>{pct(breakdown.ratioFB)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Comercial proporcional</span>
                  <span>{fmt(breakdown.comercialProporcional)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Referências */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custo Referências</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Referências (primeiras conversões)</span>
              <span className="font-medium">{breakdown.referenciasCount}</span>
            </div>
            {breakdown.referenciaCustoUnitario !== null ? (
              <div className="flex justify-between">
                <span>Custo unitário</span>
                <span className="font-medium">{fmt(breakdown.referenciaCustoUnitario)}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">€75/ref (slot/aluguer) · €200/ref (compra)</p>
            )}
            <div className="flex justify-between font-medium">
              <span>Total referências</span>
              <span>{fmt(breakdown.referenciasTotal)}</span>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="rounded-lg bg-muted/50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total</h4>
          <div className="text-xl font-display font-bold text-primary">
            {fmt(breakdown.total)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvestmentBreakdownDialog;
