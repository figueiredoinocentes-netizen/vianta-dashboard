import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { chartColors } from '@/data/mockData';
import type { MonthlyRevenue } from '@/types/dashboard';

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonthKey(key: string): string {
  const [year, month] = key.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  return `${PT_MONTHS[monthIdx] || month} ${year.slice(2)}`;
}

interface Props {
  data: MonthlyRevenue[];
  objectives?: { month: string; target: number }[];
}

const RevenueEvolutionChart = ({ data, objectives = [] }: Props) => {
  const hasObjectives = objectives.length > 0;

  const chartData = useMemo(() => {
    if (!hasObjectives) return data;

    const revenueByMonth: Record<string, MonthlyRevenue> = {};
    data.forEach(d => { revenueByMonth[d.month] = d; });

    const objByMonth: Record<string, number> = {};
    objectives.forEach(o => { objByMonth[o.month] = o.target; });

    // União de todos os meses com dados reais e/ou objectivo, ordenada cronologicamente —
    // não fica presa ao ano civil actual.
    const allMonthKeys = Array.from(new Set([...Object.keys(revenueByMonth), ...Object.keys(objByMonth)])).sort();

    return allMonthKeys.map((monthKey) => {
      const existing = revenueByMonth[monthKey];
      return {
        month: monthKey,
        label: existing?.label ?? formatMonthKey(monthKey),
        revenue: existing?.revenue ?? 0,
        activeDrivers: existing?.activeDrivers ?? 0,
        target: objByMonth[monthKey] ?? undefined,
      };
    });
  }, [data, objectives, hasObjectives]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Estimativa de Faturação Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 16%)" />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(215, 15%, 55%)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(215, 15%, 55%)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `€${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220, 20%, 10%)',
                      border: '1px solid hsl(220, 15%, 16%)',
                      borderRadius: '8px',
                      color: 'hsl(210, 40%, 96%)',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => {
                      const label = name === 'target' ? 'Objectivo' : 'Faturação';
                      return [`€${value.toLocaleString()}`, label];
                    }}
                    labelFormatter={(label: string, payload: any[]) => {
                      const item = payload?.[0]?.payload;
                      return item && item.activeDrivers ? `${label} — ${item.activeDrivers} drivers ativos` : label;
                    }}
                  />
                  {hasObjectives && (
                    <Legend
                      formatter={(value: string) => value === 'target' ? 'Objectivo' : 'Real'}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  )}
                  <Bar
                    dataKey="revenue"
                    fill={chartColors.secondary || chartColors.primary}
                    radius={[4, 4, 0, 0]}
                    name="revenue"
                  />
                  {hasObjectives && (
                    <Line
                      dataKey="target"
                      stroke="#e2b93b"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3 }}
                      connectNulls
                      name="target"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Sem dados de faturação disponíveis
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RevenueEvolutionChart;
