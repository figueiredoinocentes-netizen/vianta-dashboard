import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ConversaoBreakdown } from '@/types/dashboard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown: ConversaoBreakdown;
}

export const ConversaoBreakdownDialog = ({ open, onOpenChange, breakdown }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conversões Efetivas (Lead → Fecho)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Ticket</TableHead>
                <TableHead>Data Registo</TableHead>
                <TableHead>Data Fecho</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Criativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.conversoes.map((conv) => (
                <TableRow key={conv.id}>
                  <TableCell className="font-medium">{conv.nome}</TableCell>
                  <TableCell className="text-right">
                    {conv.ticket ? `€${conv.ticket.toFixed(0)}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {conv.dataRegisto ? new Date(conv.dataRegisto).toLocaleDateString('pt-PT') : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {conv.dataFecho ? new Date(conv.dataFecho).toLocaleDateString('pt-PT') : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{conv.fonte}</TableCell>
                  <TableCell className="text-sm">{conv.criativo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="rounded-lg bg-muted/50 p-3 space-y-1 mt-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Total Conversões:</span>
              <span className="text-lg font-bold text-primary">{breakdown.totalConversoes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Ticket Médio:</span>
              <span className="text-lg font-bold text-primary">€{breakdown.ticketMedio.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConversaoBreakdownDialog;
