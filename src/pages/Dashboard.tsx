import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts'
import { DollarSign, Users, Clock, TrendingUp, ShoppingCart, RefreshCw } from 'lucide-react'

// DB Leads Log
const LEADS_SHEET_ID = '1s9ByVhHXQppWAQsZrgudw4d4GMdzR-qaK0ObPLdRejg'
const LEADS_CSV = `https://docs.google.com/spreadsheets/d/${LEADS_SHEET_ID}/export?format=csv`

/* CSV parser */
function parseCSVLine(line: string): string[] {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) { if (c === '"' && line[i+1] === '"') { cur += '"'; i++ } else if (c === '"') inQ = false; else cur += c }
    else { if (c === '"') inQ = true; else if (c === ',') { result.push(cur); cur = '' } else cur += c }
  }
  result.push(cur)
  return result
}

interface Filters {
  period: string;
  offerType: string;
  source: string;
}

function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({ period: 'all', offerType: '', source: '' })

  useEffect(() => { loadData() }, [filters])

  async function loadData() {
    setLoading(true)
    try {
      // Load leads data
      const resp = await fetch(LEADS_CSV)
      const csv = await resp.text()
      const lines = csv.trim().split('\n')
      const headers = parseCSVLine(lines[0])
      const rawLeads = lines.slice(1).map(line => {
        const vals = parseCSVLine(line)
        const obj: any = {}
        headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim() })
        return obj
      }).filter(l => l['nome'] || l['telefone'])

      setLeads(rawLeads)

      // Calculate KPIs
      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`

      let filtered = [...rawLeads]
      
      // Apply period filter
      if (filters.period === 'month') {
        filtered = filtered.filter(l => (l['data_registo'] || '').startsWith(thisMonth))
      } else if (filters.period === 'quarter') {
        const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1)
        filtered = filtered.filter(l => {
          const d = new Date(l['data_registo'])
          return d >= qStart && d <= now
        })
      }

      // Apply offer filter
      if (filters.offerType) {
        filtered = filtered.filter(l => l['oferta']?.toLowerCase() === filters.offerType.toLowerCase())
      }

      const totalLeads = filtered.length
      const qualificadas = filtered.filter(l => l['estado'] === 'Nova Lead Qualificada' || l['estado'] === 'Crédito Aprovado' || l['estado'] === 'Fechado').length
      const fechados = filtered.filter(l => l['estado'] === 'Fechado').length
      const creditosAprovados = filtered.filter(l => l['estado'] === 'Crédito Aprovado' || l['estado'] === 'Fechado').length

      // Monthly breakdown
      const monthlyMap: Record<string, any> = {}
      filtered.forEach(l => {
        const month = (l['data_registo'] || '').slice(0, 7)
        if (!month) return
        if (!monthlyMap[month]) monthlyMap[month] = { month, leads: 0, qualificadas: 0, fechados: 0 }
        monthlyMap[month].leads++
        if (l['estado'] === 'Nova Lead Qualificada' || l['estado'] === 'Crédito Aprovado' || l['estado'] === 'Fechado') monthlyMap[month].qualificadas++
        if (l['estado'] === 'Fechado') monthlyMap[month].fechados++
      })

      const monthlyData = Object.values(monthlyMap).sort((a: any, b: any) => a.month.localeCompare(b.month))

      // Source distribution
      const sourceMap: Record<string, number> = {}
      filtered.forEach(l => {
        const src = l['fonte'] || 'Desconhecido'
        sourceMap[src] = (sourceMap[src] || 0) + 1
      })
      const sourceData = Object.entries(sourceMap).map(([name, value]) => ({ name, value }))

      const investimentoTotal = 1250 + (fechados * 0) // placeholder - need ads data
      const cacMedio = fechados > 0 ? investimentoTotal / fechados : 0

      setData({
        totalLeads,
        qualificadas,
        fechados,
        creditosAprovados,
        txConversao: totalLeads > 0 ? (fechados / totalLeads * 100) : 0,
        investimentoTotal,
        cacMedio,
        monthlyData,
        sourceData,
      })
    } catch(e) {
      console.error(e)
    }
    setLoading(false)
  }

  const metrics = [
    { title: 'Leads', value: data?.totalLeads || 0, icon: Users, color: '#3b82f6' },
    { title: 'Lead Qualificada', value: data?.qualificadas || 0, icon: Users, color: '#8b5cf6' },
    { title: 'Créditos Aprovados', value: data?.creditosAprovados || 0, icon: Clock, color: '#f59e0b' },
    { title: 'Fechos', value: data?.fechados || 0, icon: ShoppingCart, color: '#10b981' },
    { title: 'Taxa Conversão', value: `${(data?.txConversao || 0).toFixed(1)}%`, icon: TrendingUp, color: '#10b981' },
    { title: 'CAC Médio', value: `€${Math.round(data?.cacMedio || 0)}`, icon: DollarSign, color: '#ef4444' },
    { title: 'Investimento', value: `€${(data?.investimentoTotal || 0).toLocaleString()}`, icon: DollarSign, color: '#f59e0b' },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Dashboard <span style={{ background: 'linear-gradient(135deg, #1a202c, #d0c1ac)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Marketing & Comercial</span>
          </h1>
          <p style={{ color: '#718096', fontSize: 13, marginTop: 4 }}>Visão geral do desempenho — Vianta</p>
        </div>
        <button className="btn btn-outline" onClick={loadData}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="filters" style={{ marginBottom: 20 }}>
        <select value={filters.period} onChange={e => setFilters({...filters, period: e.target.value})}>
          <option value="all">Todo o período</option>
          <option value="month">Este mês</option>
          <option value="quarter">Este trimestre</option>
        </select>
        <select value={filters.offerType} onChange={e => setFilters({...filters, offerType: e.target.value})}>
          <option value="">Todas as ofertas</option>
          <option value="Aluguer">Aluguer</option>
          <option value="Compra">Compra</option>
          <option value="Slot">Slot</option>
        </select>
        <span className="count">{data?.totalLeads || 0} leads</span>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} className="stat-card" style={{ height: 100 }}>
              <div style={{ background: '#e2e8f0', height: 10, width: '60%', borderRadius: 4, marginBottom: 8 }}>&nbsp;</div>
              <div style={{ background: '#e2e8f0', height: 24, width: '40%', borderRadius: 4 }}>&nbsp;</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stats-grid">
          {metrics.map((m, i) => (
            <div key={i} className="stat-card">
              <div className="label">{m.title}</div>
              <div className="value" style={{ color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Monthly Evolution */}
        <div className="card">
          <div className="card-header"><h3>Evolução Mensal</h3></div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthlyData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="leads" name="Leads" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="qualificadas" name="Qualificadas" fill="#8b5cf6" radius={[4,4,0,0]} />
                <Bar dataKey="fechados" name="Fechos" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source Distribution */}
        <div className="card">
          <div className="card-header"><h3>Distribuição por Fonte</h3></div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.sourceData || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }: any) => `${name} ${((percent || 0)*100).toFixed(0)}%`}
                >
                  {(data?.sourceData || []).map((_: any, i: number) => (
                    <Cell key={i} fill={['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#d0c1ac'][i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header"><h3>Últimas Leads</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Oferta</th>
                <th>Estado</th>
                <th>Data</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 10).map((l: any, i: number) => (
                <tr key={i}>
                  <td>{l['nome'] || '-'}</td>
                  <td>{l['telefone'] || '-'}</td>
                  <td>{l['oferta'] || '-'}</td>
                  <td><span className="badge badge-stand">{l['estado'] || '-'}</span></td>
                  <td>{l['data_registo'] || '-'}</td>
                  <td>{l['fonte'] || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard