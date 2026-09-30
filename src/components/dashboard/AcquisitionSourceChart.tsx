import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_PALETTE } from '@/data/mockData';
import type { SourceDistribution } from '@/types/dashboard';

interface Props {
  data: SourceDistribution[];
}

const renameSource = (source: string): string =>
  source?.toLowerCase() === 'facebook' ? 'Meta Ads' : source;

const AcquisitionSourceChart = ({ data }: Props) => {
  const displayData = useMemo(
    () => data.map(d => ({ ...d, source: renameSource(d.source) })),
    [data],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Distribuição por Fonte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {displayData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="source"
                    strokeWidth={0}
                  >
                    {displayData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                    <LabelList
                      dataKey="percentage"
                      position="outside"
                      formatter={(value: number) => (value >= 1 ? `${value}%` : '')}
                      style={{
                        fill: 'hsl(210, 40%, 96%)',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                      stroke="none"
                    />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220, 20%, 10%)',
                      border: '1px solid hsl(220, 15%, 16%)',
                      borderRadius: '8px',
                      color: 'hsl(210, 40%, 96%)',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => {
                      const item = displayData.find(d => d.source === name);
                      return [`${value} drivers (${item?.percentage || 0}%)`, name];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Sem dados disponíveis
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AcquisitionSourceChart;
