import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { THEME_PREF_KEY } from './lib/theme'

try {
  if (localStorage.getItem(THEME_PREF_KEY) === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch {
  /* private mode / denied */
}

class RenderErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
          <div className="max-w-lg rounded-lg border border-rose-500/50 bg-slate-800 p-6 text-white">
            <h1 className="text-lg font-semibold text-rose-400">Грешка при рендиране</h1>
            <p className="mt-2 text-sm text-slate-300">{this.state.error.message}</p>
            <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-900 p-3 text-xs">
              {this.state.error.stack}
            </pre>
            <button
              className="mt-4 rounded bg-rose-500 px-3 py-1 text-sm hover:bg-rose-600"
              onClick={() => this.setState({ error: null })}
            >
              Опитай отново
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

if (!window.api) {
  console.error('window.api is not available. Make sure preload script is loaded.')
}

const root = document.getElementById('root')
if (!root) {
  document.body.innerHTML = '<div style="padding:20px;color:red;">Root element not found.</div>'
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <RenderErrorBoundary>
        <App />
      </RenderErrorBoundary>
    </React.StrictMode>
  )
}
