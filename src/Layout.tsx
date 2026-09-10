import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Filter, Calendar, Bot, Car, Settings, TrendingUp } from 'lucide-react'

const navGroups = [
  {
    label: 'Aquisição (Mkt & Vendas)',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/marketing', label: 'Marketing', icon: TrendingUp },
      { to: '/funil', label: 'Funil de Vendas', icon: Filter },
      { to: '/planeamento', label: 'Planeamento', icon: Calendar },
    ],
  },
  {
    label: 'Operações',
    items: [
      { to: '/operacoes', label: 'Gestão de Frota', icon: Car },
    ],
  },
  {
    label: 'Geral',
    items: [
      { to: '/assistente', label: 'Assistente', icon: Bot },
      { to: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
]

function Layout() {
  return (
    <div>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img 
            src="https://dashboardaquisicaovianta.lovable.app/assets/vianta-logo-BV7m2ycm.jpeg" 
            alt="Vianta" 
            style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }}
          />
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>VIANTA</h1>
            <p style={{ fontSize: 10, margin: 0, opacity: 0.6 }}>Fleet Success Hub</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navGroups.map(group => (
            <div key={group.label} className="sidebar-group">
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout