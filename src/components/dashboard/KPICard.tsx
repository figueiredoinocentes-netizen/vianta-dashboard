import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface KPICardProps {
  title: string;
  value: string;
  variation?: number;
  icon: React.ReactNode;
  delay?: number;
  tooltip?: string;
  onClick?: () => void;
  objective?: number;
  objectiveLabel?: string;
  numericValue?: number;
  secondaryValue?: string;
  secondaryLabel?: string;
  selected?: boolean;
}

const KPICard = ({ title, value, variation, icon, delay = 0, tooltip, onClick, objective, objectiveLabel, numericValue, secondaryValue, secondaryLabel, selected }: KPICardProps) => {
  const showVariation = variation !== undefined && variation !== 0;
  const isPositive = (variation ?? 0) >= 0;

  const hasObjective = objective !== undefined && objective > 0 && numericValue !== undefined;
  const pct = hasObjective ? (numericValue! / objective!) * 100 : undefined;
  const valueColor = pct !== undefined
    ? pct >= 100 ? 'text-chart-emerald' : pct >= 80 ? 'text-yellow-400' : 'text-chart-rose'
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn("glass-card rounded-xl p-5 hover:border-primary/30 transition-all duration-300", onClick && "cursor-pointer hover:shadow-md", selected && "ring-2 ring-primary border-primary/50")}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          {title}
        </span>
        {tooltip ? (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <button type="button" className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary cursor-help border-0 outline-none">
                {icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-end justify-between gap-3">
          <p className={cn("text-2xl font-display font-bold", valueColor || "text-foreground")}>{value}</p>
          {secondaryValue !== undefined ? (
            <div className="flex flex-col items-end leading-tight">
              <p className="text-lg font-display font-semibold text-muted-foreground">{secondaryValue}</p>
              {secondaryLabel && (
                <span className="text-[10px] text-muted-foreground">{secondaryLabel}</span>
              )}
            </div>
          ) : showVariation && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
                isPositive
                  ? 'bg-chart-emerald/10 text-chart-emerald'
                  : 'bg-chart-rose/10 text-chart-rose'
              )}
            >
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isPositive ? '+' : ''}{(variation ?? 0).toFixed(1)}%
            </div>
          )}
        </div>
        {hasObjective && objectiveLabel && (
          <p className="text-[10px] text-muted-foreground">
            Obj. trim.: {objectiveLabel}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default KPICard;
