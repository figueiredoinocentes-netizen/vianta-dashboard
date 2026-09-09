import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './Layout'
import Dashboard from './pages/Dashboard'
import Marketing from './pages/Marketing'
import Funil from './pages/Funil'
import Planeamento from './pages/Planeamento'
import Assistente from './pages/Assistente'
import Operacoes from './pages/Operacoes'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/funil" element={<Funil />} />
        <Route path="/planeamento" element={<Planeamento />} />
        <Route path="/assistente" element={<Assistente />} />
        <Route path="/operacoes" element={<Operacoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App