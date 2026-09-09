import { useState, useEffect } from 'react'

const LEADS_SHEET_ID = '1s9ByVhHXQppWAQsZrgudw4d4GMdzR-qaK0ObPLdRejg'
const CSV_URL = `https://docs.google.com/spreadsheets/d/${LEADS_SHEET_ID}/export?format=csv`

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

const funnelStages = [
  { key: 'Nova Lead', label: 'Leads Geradas', color: '#3b82f6' },
  { key: 'Nova Lead Qualificada', label: 'Leads Qualificadas', color: '#8b5cf6' },
  { key: 'Pré Aprovação Submetida', label: 'Pré-Aprovações', color: '#f59e0b' },
  { key: 'Crédito Aprovado', label: 'Créditos Aprovados', color: '#f97316' },
  { key: 'Fechado', label: 'Fechos', color: '#10b981' },
]

function Funil() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch(CSV_URL)
        const csv = await resp.text()
        const lines = csv.trim().split('\n')
        const headers = parseCSVLine(lines[0])
        const data = lines.slice(1).map(line => {
          const vals = parseCSVLine(line)
          const obj: any = {}
          headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim() })
          return obj
        }).filter(l => l['nome'] || l['telefone'])
        setLeads(data)
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  const stages = funnelStages.map(s => ({
    ...s,
    count: leads.filter(l => l['estado'] === s.key).length,
    pct: leads.length > 0 ? (leads.filter(l => l['estado'] === s.key).length / leads.length * 100) : 0,
  }))

  const maxCount = Math.max(...stages.map(s => s.count), 1)

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Funil de Vendas</h2>
      <p style={{ color: '#718096', fontSize: 13, marginBottom: 24 }}>Métricas de conversão por etapa — {leads.length} leads totais</p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#718096' }}>A carregar...</div>
      ) : (
        <div className="card">
          <div className="card-body">
            {stages.map((stage, i) => (
              <div key={stage.key} style={{ marginBottom: i < stages.length - 1 ? 24 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{stage.label}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: stage.color }}>{stage.count}</span>
                </div>
                <div style={{ 
                  position: 'relative', 
                  height: 40, 
                  background: i < stages.length - 1 ? '#f1f5f9' : '#e2e8f0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  clipPath: i < stages.length - 1 ? 'polygon(2% 0%, 98% 0%, 100% 100%, 0% 100%)' : undefined,
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(stage.count / maxCount) * 100}%`,
                    background: `linear-gradient(90deg, ${stage.color}, ${stage.color}88)`,
                    borderRadius: 8,
                    transition: 'width 0.5s ease',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 12,
                  }}>
                    <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>
                      {stage.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                {i < stages.length - 1 && (
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#718096', marginTop: 2 }}>
                    {stages[i+1].count > 0 && stage.count > 0 ? 
                      `${(stages[i+1].count / stage.count * 100).toFixed(1)}% conversão` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Funil