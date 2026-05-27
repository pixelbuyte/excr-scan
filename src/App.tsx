import { Routes, Route } from 'react-router-dom'
import Landing      from './pages/Landing'
import Scanner      from './pages/Scanner'
import CompeteLobby from './pages/CompeteLobby'
import './index.css'

export default function App() {
  return (
    <Routes>
      <Route path="/"        element={<Landing />}      />
      <Route path="/scan"    element={<Scanner />}      />
      <Route path="/compete" element={<CompeteLobby />} />
    </Routes>
  )
}
