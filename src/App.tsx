import { Routes, Route } from 'react-router-dom'
import Landing        from './pages/Landing'
import Scanner        from './pages/Scanner'
import CompeteLobby   from './pages/CompeteLobby'
import Settings       from './pages/Settings'
import DailyChallenge from './pages/DailyChallenge'
import History        from './pages/History'
import { CompeteProvider } from './hooks/useCompete'
import './index.css'

export default function App() {
  return (
    <CompeteProvider>
      <Routes>
        <Route path="/"        element={<Landing />}        />
        <Route path="/scan"    element={<Scanner />}        />
        <Route path="/compete" element={<CompeteLobby />}   />
        <Route path="/settings" element={<Settings />}      />
        <Route path="/daily"   element={<DailyChallenge />} />
        <Route path="/history" element={<History />}        />
      </Routes>
    </CompeteProvider>
  )
}
