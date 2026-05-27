import './index.css'

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </div>

        <h1 className="text-4xl font-bold tracking-tight">ExcrScan</h1>
        <p className="text-white/50 text-lg">Coming soon</p>

        <div className="h-px bg-white/10 my-8" />

        <p className="text-white/30 text-sm">
          Built by{" "}
          <a href="https://github.com/pixelbuyte" className="text-white/50 hover:text-white transition-colors">
            pixelbuyte
          </a>
        </p>
      </div>
    </div>
  )
}
