import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { chartColors } from '@/data/mockData';
import type { MonthlyClosings } from '@/types/dashboard';

interface Props {
  data: MonthlyClosings[];
}

const ClosingsEvolutionChart = ({ data }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Evolução de Fechos e Churns por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
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
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220, 20%, 10%)',
                      border: '1px solid hsl(220, 15%, 16%)',
                      borderRadius: '8px',
                      color: 'hsl(210, 40%, 96%)',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => [
                      value,
                      name === 'count' ? 'Fechos' : 'Churns',
                    ]}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === 'count' ? 'Fechos' : 'Churns'
                    }
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  <Bar
                    dataKey="count"
                    fill={chartColors.primary}
                    radius={[4, 4, 0, 0]}
                    name="count"
                  />
                  <Bar
                    dataKey="churns"
                    fill={chartColors.danger}
                    radius={[4, 4, 0, 0]}
                    name="churns"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Sem dados de fechos disponíveis
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ClosingsEvolutionChart;
