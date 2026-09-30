import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import type { RawLead } from '@/types/dashboard';

export interface LeadsListDialogLead {
  id: string;
  nome: string;
  oferta: string;
  dataRegisto: string | null;
  fonte: string;
  missing?: boolean;
  stage?: string;
}

interface LeadsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  leads: LeadsListDialogLead[];
  showStageColumn?: boolean;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'dd/MM/yyyy');
  } catch {
    return '—';
  }
}

const LeadsListDialog = ({ open, onOpenChange, title, description, leads, showStageColumn }: LeadsListDialogProps) => {
  const [search, setSearch] = useState('');

  const sorted = useMemo(() => {
    const copy = [...leads];
    copy.sort((a, b) => {
      if (!a.dataRegisto && !b.dataRegisto) return 0;
      if (!a.dataRegisto) return 1;
      if (!b.dataRegisto) return -1;
      return b.dataRegisto.localeCompare(a.dataRegisto);
    });
    return copy;
  }, [leads]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(l => l.nome.toLowerCase().includes(q));
  }, [sorted, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription className="whitespace-pre-line">{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <Input
            placeholder="Pesquisar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Badge variant="secondary">{filtered.length} de {leads.length}</Badge>
        </div>

        <div className="flex-1 overflow-auto border border-border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Oferta</TableHead>
                <TableHead>Data registo</TableHead>
                <TableHead>Fonte</TableHead>
                {showStageColumn && <TableHead>Stage</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showStageColumn ? 5 : 4} className="text-center text-muted-foreground py-8">
                    Nenhuma lead encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.id} className={l.missing ? 'opacity-70' : ''}>
                    <TableCell className="font-medium">
                      {l.nome}
                      {l.missing && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          fora de RAW_LEADS
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{l.oferta || '—'}</TableCell>
                    <TableCell>{formatDate(l.dataRegisto)}</TableCell>
                    <TableCell>{l.fonte || '—'}</TableCell>
                    {showStageColumn && (
                      <TableCell>
                        {l.stage ? <Badge variant="secondary">{l.stage}</Badge> : '—'}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadsListDialog;

// Helper to convert RawLead[] to LeadsListDialogLead[]
export function rawLeadsToDialog(leads: RawLead[]): LeadsListDialogLead[] {
  return leads.map(l => ({
    id: l.id,
    nome: l.nome,
    oferta: l.oferta,
    dataRegisto: l.dataRegisto,
    fonte: l.fonte,
  }));
}
