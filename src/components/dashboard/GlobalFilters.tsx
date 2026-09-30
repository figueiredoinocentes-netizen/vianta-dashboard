import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { FilterState, OfferType } from '@/types/dashboard';
import { useMemo } from 'react';

interface GlobalFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  fontes?: string[];
}

const PT_MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const GlobalFilters = ({ filters, onFiltersChange, fontes = [] }: GlobalFiltersProps) => {
  const dateFrom = filters.customDateFrom ? new Date(filters.customDateFrom) : undefined;
  const dateTo = filters.customDateTo ? new Date(filters.customDateTo) : undefined;

  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${PT_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      options.push({ value, label });
    }
    return options;
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={filters.period}
        onValueChange={(val) => onFiltersChange({ ...filters, period: val as FilterState['period'] })}
      >
        <SelectTrigger className="w-[160px] bg-secondary border-border text-sm">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
          <SelectItem value="90d">Últimos 90 dias</SelectItem>
          <SelectItem value="12m">Últimos 12 meses</SelectItem>
          <SelectItem value="all">Todo o período</SelectItem>
          <SelectItem value="month">Por mês</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>

      {filters.period === 'month' && (
        <Select
          value={filters.selectedMonth || monthOptions[0]?.value}
          onValueChange={(val) => onFiltersChange({ ...filters, selectedMonth: val })}
        >
          <SelectTrigger className="w-[180px] bg-secondary border-border text-sm">
            <SelectValue placeholder="Selecionar mês" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {filters.period === 'custom' && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[140px] justify-start text-left text-sm font-normal bg-secondary border-border',
                  !dateFrom && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Data início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(date) =>
                  onFiltersChange({
                    ...filters,
                    customDateFrom: date ? format(date, 'yyyy-MM-dd') : undefined,
                  })
                }
                locale={pt}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[140px] justify-start text-left text-sm font-normal bg-secondary border-border',
                  !dateTo && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Data fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(date) =>
                  onFiltersChange({
                    ...filters,
                    customDateTo: date ? format(date, 'yyyy-MM-dd') : undefined,
                  })
                }
                locale={pt}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[160px] justify-start text-left text-sm font-normal bg-secondary border-border"
          >
            {filters.offerTypes.length === 0 || filters.offerTypes.length === 3
              ? 'Todos'
              : filters.offerTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-3" align="start">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Tipo de Oferta</p>
            {(['slot', 'aluguer', 'compra'] as OfferType[]).map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.offerTypes.includes(type)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...filters.offerTypes, type]
                      : filters.offerTypes.filter(t => t !== type);
                    onFiltersChange({ ...filters, offerTypes: next });
                  }}
                />
                <span className="text-sm capitalize">{type}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Select
        value={filters.source}
        onValueChange={(val) => onFiltersChange({ ...filters, source: val })}
      >
        <SelectTrigger className="w-[180px] bg-secondary border-border text-sm">
          <SelectValue placeholder="Fonte" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas as Fontes</SelectItem>
          {fontes.map((fonte) => (
            <SelectItem key={fonte} value={fonte}>
              {fonte}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default GlobalFilters;
