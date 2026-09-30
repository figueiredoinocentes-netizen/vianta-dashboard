import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CHART_PALETTE } from '@/data/mockData';
import type { GHLPipeline, GHLFunnelMetric } from '@/types/dashboard';

interface GHLFunnelCardProps {
  pipeline: GHLPipeline;
  funnelMetrics: GHLFunnelMetric[];
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${Math.round(value)}`;
}

const GHLFunnelCard = ({ pipeline, funnelMetrics }: GHLFunnelCardProps) => {
  const maxReached = Math.max(...funnelMetrics.map(m => m.cumulativeReached), 1);

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Pipeline — {pipeline.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-w-2xl mx-auto">
          {funnelMetrics.map((metric, idx) => {
            const pct = (metric.cumulativeReached / maxReached) * 100;
            const color = CHART_PALETTE[idx % CHART_PALETTE.length];
            const isFirst = idx === 0;

            return (
              <div key={metric.stageName}>
                {/* Stage bar */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground">{metric.stageName}</span>
                    <div className="flex items-center gap-3">
                      {metric.monetaryValue > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(metric.monetaryValue)}
                        </span>
                      )}
                      <span className="text-sm font-display font-bold text-foreground">
                        {metric.cumulativeReached}
                      </span>
                      {isFirst && (
                        <span className="text-xs text-muted-foreground">(100%)</span>
                      )}
                    </div>
                  </div>
                  <div className="h-9 rounded-lg bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(pct, 3)}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.15, ease: 'easeOut' }}
                      className="h-full rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      {pct > 15 && (
                        <span className="text-xs font-medium text-white drop-shadow-sm">
                          {metric.cumulativeReached}
                        </span>
                      )}
                    </motion.div>
                  </div>
                </div>

                {/* Conversion rate from base (Lead Qualificada) */}
                {!isFirst && idx < funnelMetrics.length && (
                  <div className="flex justify-center my-1.5">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.15 + 0.3 }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <span className={
                        metric.conversionFromBase >= 50
                          ? 'text-emerald-500'
                          : metric.conversionFromBase >= 25
                            ? 'text-amber-500'
                            : 'text-destructive'
                      }>
                        {metric.conversionFromBase.toFixed(1)}% desde LQ
                      </span>
                    </motion.div>
                  </div>
                )}

                {/* Arrow between stages (except after last) */}
                {idx < funnelMetrics.length - 1 && isFirst && (
                  <div className="flex justify-center my-1.5">
                    <span className="text-xs text-muted-foreground">↓</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export const GHLFunnelSkeleton = () => (
  <Card className="glass-card border-border/50">
    <CardHeader className="pb-2">
      <Skeleton className="h-4 w-48" />
    </CardHeader>
    <CardContent>
      <div className="space-y-4 max-w-2xl mx-auto">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-9 rounded-lg" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export default GHLFunnelCard;
