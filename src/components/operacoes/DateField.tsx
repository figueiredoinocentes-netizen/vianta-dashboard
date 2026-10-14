import { useState } from 'react';
import { format, parse } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** Seletor de data com calendário em dropdown. `value` e `onChange` usam 'yyyy-MM-dd' ('' = vazio). */
export function DateField({
  value,
  onChange,
  clearable,
  placeholder = 'Escolher data',
}: {
  value: string;
  onChange: (v: string) => void;
  clearable?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm',
              !date && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            {date ? format(date, 'dd/MM/yyyy') : placeholder}
          </button>
        </PopoverTrigger>
        {clearable && date && (
          <button
            type="button"
            aria-label="Limpar data"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => onChange('')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={pt}
          selected={date}
          defaultMonth={date}
          onSelect={(d) => {
            if (!d) return;
            onChange(format(d, 'yyyy-MM-dd'));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
