/**
 * JaNIS 3D Orbital View — Plano de implementação
 * 
 * Baseado no brief-jarvis-aios-orbita-3d.md e no protótipo centro-comando.dc.html
 * 
 * ## Estrutura
 * 
 * AiosPage.tsx (refactor) — container com 3 colunas
 * ├── Coluna Esquerda: relógio, progresso, perfis
 * ├── Coluna Centro:    Órbita 3D (canvas + Three.js)
 * └── Coluna Direita:   "Precisa de ti", lista de rotinas
 * 
 * ## Componentes
 * 
 * 1. AiosOrbit3D.tsx       — motor 3D: nós, arestas, rotação, zoom, destaque
 * 2. AiosLeftPanel.tsx     — perfis, relógio, próximas execuções
 * 3. AiosRightPanel.tsx    — alertas "Precisa de ti", rotinas
 * 4. AiosPopup.tsx         — pop-up asset com regra acima/abaixo
 * 5. AiosFilterBar.tsx     — filtros por área/tipo, pesquisa, nomes toggle
 * 
 * ## Dados
 * 
 * Lê do aios-state.json (já publicado) — graph { nodes, edges }
 * 
 * ## 3D Engine
 * 
 * - THREE.js (a instalar) para projeção 3D com matriz de rotação
 * - Nós: formas por tipo (hexágono=agente, losango=skill, anel=cron, quadrado=integ, ponto=ficheiro)
 * - Cores: por área (paleta do brief secção 9)
 * - Arestas: linhas entre nós com opacidade por distância
 * - Rotação: drag horizontal/vertical, Shift+drag para tilt, auto-rotação toggle
 * - Zoom: Ctrl+scroll, 0.4x-3x
 * - Destaque: hover → brilho, clique → fixa, Shift+clique → adiciona
 * - Pop-up: duplo clique ou clique em nó já destacado
 */

export const ORBIT_PLAN = {
  version: '1.0',
  phase: 'implementation-ready',
  files: [
    'src/components/aios3d/AiosOrbit3D.tsx',
    'src/components/aios3d/AiosLeftPanel.tsx',
    'src/components/aios3d/AiosRightPanel.tsx',
    'src/components/aios3d/AiosPopup.tsx',
    'src/components/aios3d/AiosFilterBar.tsx',
    'src/pages/AiosPage.tsx (refactor)',
  ],
  dependencies: ['three'],
  palette: {
    comercial: '#3987e5',
    marketing: '#d95926',
    turismo: '#199e70',
    conhecimento: '#c98500',
    web: '#d55181',
    dados: '#008300',
    sistema: '#9085e9',
  },
};