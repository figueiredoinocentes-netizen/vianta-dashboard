import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MonthlyClosingDetail } from '@/types/dashboard';

interface Props {
  data: MonthlyClosingDetail[];
}

const MonthlyClosingsDetail = ({ data }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass-card rounded-xl p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Detalhe de Fechos por Mês
      </h3>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {data.map((month) => (
            <AccordionItem
              key={month.month}
              value={month.month}
              className="border border-border rounded-lg px-4 bg-secondary/30"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-4 text-sm w-full">
                  <span className="font-semibold text-foreground min-w-[70px] text-left">
                    {month.label}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {month.totalCount} {month.totalCount === 1 ? 'fecho' : 'fechos'}
                  </Badge>
                  <span className="text-muted-foreground text-xs ml-auto mr-2">
                    Ticket médio: €{Math.round(month.avgTicket).toLocaleString()}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1 space-y-4">
                {/* Breakdown badges */}
                <div className="flex flex-wrap gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Por oferta</p>
                    <div className="flex flex-wrap gap-1.5">
                      {month.byOffer.map((o) => (
                        <Badge key={o.offer} variant="outline" className="text-xs">
                          {o.offer}: {o.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Por fonte</p>
                    <div className="flex flex-wrap gap-1.5">
                      {month.bySource.map((s) => (
                        <Badge key={s.source} variant="outline" className="text-xs">
                          {s.source}: {s.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Drivers table */}
                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">Oferta</TableHead>
                        <TableHead className="text-xs">Ticket</TableHead>
                        <TableHead className="text-xs">Fonte</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {month.drivers.map((d, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="py-1.5">{d.nome}</TableCell>
                          <TableCell className="py-1.5">{d.tipoOferta}</TableCell>
                          <TableCell className="py-1.5">
                            {d.ticket != null ? `€${d.ticket.toLocaleString()}` : '—'}
                          </TableCell>
                          <TableCell className="py-1.5">{d.fonte}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </motion.div>
  );
};

export default MonthlyClosingsDetail;
