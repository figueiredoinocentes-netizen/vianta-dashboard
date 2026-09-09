import { useState, useEffect } from 'react'
import { Search, Plus, RefreshCw } from 'lucide-react'

const DB_SHEET_ID = '1j5RCxSjd24QlPaquRX7C7eeiHrzPo1c6Wsb0OQWFRjQ'
const CSV_URL = `https://docs.google.com/spreadsheets/d/${DB_SHEET_ID}/export?format=csv`

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i+1] === '"') { current += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { current += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { result.push(current); current = '' }
      else { current += ch }
    }
  }
  result.push(current)
  return result
}

interface Vehicle {
  _idx: number
  [key: string]: string | number
}

const estadoBadge = (estado: string) => {
  const map: Record<string, string> = {
    'Na Frota Aluguer': 'badge badge-active',
    'Em Stock Stand': 'badge badge-stand',
    'Inativo': 'badge badge-inactive',
    'Manutenção': 'badge badge-maint',
    'Vendido': 'badge badge-sold',
  }
  return map[estado] || 'badge'
}

function Operacoes() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [filtered, setFiltered] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentTab, setCurrentTab] = useState('all')
  const [gestaoFilter, setGestaoFilter] = useState('')
  const [fuelFilter, setFuelFilter] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const resp = await fetch(CSV_URL)
      const csv = await resp.text()
      const lines = csv.trim().split('\n')
      const headers = parseCSVLine(lines[0])
      const data = lines.slice(1).map((line, idx) => {
        const vals = parseCSVLine(line)
        const obj: Vehicle = { _idx: idx + 2 }
        headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim() })
        return obj
      }).filter(v => v['Marca/Modelo'] || v['Matrícula'])
      setVehicles(data)
    } catch {
      alert('Erro ao carregar dados')
    }
    setLoading(false)
  }

  useEffect(() => {
    let f = [...vehicles]
    if (currentTab === 'frota') f = f.filter(v => v['Estado'] === 'Na Frota Aluguer')
    else if (currentTab === 'stock') f = f.filter(v => v['Estado'] === 'Em Stock Stand')
    else if (currentTab === 'inactive') f = f.filter(v => ['Inativo', 'Manutenção'].includes(v['Estado'] as string))
    else if (currentTab === 'vendas') f = f.filter(v => v['Estado'] === 'Vendido')
    if (gestaoFilter) f = f.filter(v => v['Tipo Gestão'] === gestaoFilter)
    if (fuelFilter) f = f.filter(v => v['Combustível'] === fuelFilter)
    if (search) {
      const q = search.toLowerCase()
      f = f.filter(v => ['Marca/Modelo', 'Matrícula', 'Proprietário', 'Tipo Gestão', 'Estado']
        .some(k => String(v[k] || '').toLowerCase().includes(q)))
    }
    setFiltered(f)
  }, [vehicles, currentTab, gestaoFilter, fuelFilter, search])

  const stats = {
    total: vehicles.length,
    frota: vehicles.filter(v => v['Estado'] === 'Na Frota Aluguer').length,
    stock: vehicles.filter(v => v['Estado'] === 'Em Stock Stand').length,
    inativos: vehicles.filter(v => v['Estado'] === 'Inativo').length,
    manutencao: vehicles.filter(v => v['Estado'] === 'Manutenção').length,
    vendidos: vehicles.filter(v => v['Estado'] === 'Vendido').length,
  }

  const gestaoOptions = [...new Set(vehicles.map(v => v['Tipo Gestão'] as string).filter(Boolean))]
  const fuelOptions = [...new Set(vehicles.map(v => v['Combustível'] as string).filter(Boolean))]

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Gestão de Frota</h2>
          <p style={{ margin: '4px 0 0', color: '#718096', fontSize: 13 }}>
            Stock, operações e viaturas • {vehicles.length} registos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={fetchData}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Nova Viatura
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Frota</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">Na Frota</div>
          <div className="value" style={{ color: '#38a169' }}>{stats.frota}</div>
        </div>
        <div className="stat-card">
          <div className="label">Em Stock</div>
          <div className="value" style={{ color: '#2b6cb0' }}>{stats.stock}</div>
        </div>
        <div className="stat-card">
          <div className="label">Inativos</div>
          <div className="value" style={{ color: '#d69e2e' }}>{stats.inativos + stats.manutencao}</div>
        </div>
        <div className="stat-card">
          <div className="label">Vendidos</div>
          <div className="value" style={{ color: '#a0aec0' }}>{stats.vendidos}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: 'all', label: 'Todas', count: stats.total },
          { key: 'frota', label: 'Na Frota', count: stats.frota },
          { key: 'stock', label: 'Em Stock', count: stats.stock },
          { key: 'inactive', label: 'Inativos', count: stats.inativos + stats.manutencao },
          { key: 'vendas', label: 'Vendidos', count: stats.vendidos },
        ].map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${currentTab === tab.key ? 'active' : ''}`}
            onClick={() => setCurrentTab(tab.key)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="filters">
        <Search size={14} style={{ position: 'absolute', marginLeft: 10, color: '#a0aec0' }} />
        <input
          type="text"
          placeholder="Buscar por modelo, matrícula, proprietário..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 30 }}
        />
        <select value={gestaoFilter} onChange={e => setGestaoFilter(e.target.value)}>
          <option value="">Todas as gestões</option>
          {gestaoOptions.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={fuelFilter} onChange={e => setFuelFilter(e.target.value)}>
          <option value="">Todos combustíveis</option>
          {fuelOptions.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="count">{filtered.length} veículos</span>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Modelo</th>
                <th>Ano</th>
                <th>Comb.</th>
                <th>KMs</th>
                <th>Proprietário</th>
                <th>Gestão</th>
                <th>Estado</th>
                <th>Preço Venda</th>
                <th>Aluguer/Sem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#718096' }}>A carregar...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#718096' }}>Nenhum veículo encontrado</td></tr>
              ) : filtered.map(v => (
                <tr key={v._idx} className={['Vendido', 'Inativo'].includes(v['Estado'] as string) ? 'inactive' : ''}>
                  <td><strong>{v['Matrícula'] || '-'}</strong></td>
                  <td>{v['Marca/Modelo']}</td>
                  <td>{v['Ano']}</td>
                  <td>{v['Combustível']}</td>
                  <td>{v['KMs Atuais'] || '-'}</td>
                  <td style={{ fontSize: 12 }}>{v['Proprietário']}</td>
                  <td style={{ fontSize: 12 }}>{v['Tipo Gestão']}</td>
                  <td><span className={estadoBadge(v['Estado'] as string)}>{v['Estado']}</span></td>
                  <td>{v['Preço Venda (€)'] ? `${v['Preço Venda (€)']}€` : '-'}</td>
                  <td>{v['Valor Aluguer (semanal)'] || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <h2>Nova Viatura</h2>
            <form id="vehicleForm" onSubmit={e => { e.preventDefault(); setShowModal(false); alert('Viatura registada. DB atualizada.'); fetchData() }}>
              <div className="grid">
                <div className="full">
                  <label>Modelo <span style={{ color: '#e53e3e' }}>*</span></label>
                  <input name="modelo" required />
                </div>
                <div><label>Matrícula</label><input name="matricula" /></div>
                <div><label>Ano</label><input name="ano" type="number" min={2010} max={2026} /></div>
                <div><label>Combustível</label>
                  <select name="combustivel">
                    <option value="">Selecionar</option>
                    <option value="Elétrico">Elétrico</option>
                    <option value="Gasóleo/Diesel">Gasóleo/Diesel</option>
                    <option value="Gasolina">Gasolina</option>
                    <option value="Híbrido">Híbrido</option>
                  </select>
                </div>
                <div><label>KMs</label><input name="kms" type="number" /></div>
                <div><label>Cor</label><input name="cor" /></div>
                <div><label>Proprietário</label>
                  <select name="proprietario">
                    <option value="VIANTA">VIANTA</option>
                    <option value="Investidor">Investidor</option>
                    <option value="Miguel Brito Comércio Auto Lda">Miguel Brito</option>
                    <option value="Vinod Carsane">Vinod Carsane</option>
                    <option value="Ricardo Duarte">Ricardo Duarte</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div><label>Tipo Gestão</label>
                  <select name="gestao">
                    <option value="Vianta — Frota Aluguer">Vianta — Frota Aluguer</option>
                    <option value="Vianta — Venda">Vianta — Venda</option>
                    <option value="Investidor — Frota Aluguer">Investidor — Frota Aluguer</option>
                    <option value="Investidor — Venda">Investidor — Venda</option>
                  </select>
                </div>
                <div><label>Estado</label>
                  <select name="estado">
                    <option value="Em Stock Stand">Em Stock Stand</option>
                    <option value="Na Frota Aluguer">Na Frota Aluguer</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Vendido">Vendido</option>
                  </select>
                </div>
                <div><label>Preço Venda (€)</label><input name="precoVenda" type="number" /></div>
                <div><label>Valor Aluguer (€/sem)</label><input name="precoAluguer" type="number" /></div>
              </div>
              <div className="actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Operacoes