import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function reportRendererError(payload: { message?: string; stack?: string; type?: string; url?: string; line?: number | string; col?: number | string }) {
  try {
    window.smmDesktop?.logError?.(payload)
  } catch {
    // Logging must never destabilize the renderer.
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    reportRendererError({
      message: event.message,
      stack: event.error?.stack,
      type: 'Uncaught Error',
      url: event.filename,
      line: event.lineno,
      col: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportRendererError({
      message: reason?.message || String(reason),
      stack: reason?.stack,
      type: 'Unhandled Rejection',
    })
  })
}

class ErrorBoundary extends Component<{ children?: React.ReactNode }, { hasError: boolean; error: unknown; info: { componentStack?: string } | null }> {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    reportRendererError({
      message: (error as Error)?.message || String(error),
      stack: `${(error as Error)?.stack || ''}\n${info?.componentStack || ''}`.trim(),
      type: 'React ErrorBoundary',
    })
    console.error('[FluxAura Studio ErrorBoundary] Render crash:', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      const errText = String((this.state.error as Error)?.stack || this.state.error || 'Unknown error')
      const stack = this.state.info?.componentStack || ''
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#1a1a2e', color: '#ff4444', minHeight: '100vh', boxSizing: 'border-box' }}>
          <h1 style={{ color: '#ff6b6b', marginTop: 0 }}>⚠ FluxAura Studio Crashed</h1>
          <p style={{ color: '#ccc', margin: '0 0 16px' }}>
            An unhandled render error caused the app to crash. Press <kbd style={{ background: '#333', padding: '2px 6px', borderRadius: 4 }}>F12</kbd> for full DevTools console output.
          </p>
          <pre style={{ background: '#0d0d1a', padding: 16, borderRadius: 8, color: '#ff9999', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 300, overflowY: 'auto', fontSize: 13 }}>
            {errText}
          </pre>
          {stack && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ color: '#888', cursor: 'pointer', fontSize: 12 }}>Component stack</summary>
              <pre style={{ background: '#0d0d1a', padding: 12, borderRadius: 8, color: '#888', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 11, maxHeight: 240, overflowY: 'auto' }}>
                {stack}
              </pre>
            </details>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
            style={{ marginTop: 20, padding: '10px 28px', background: '#4444aa', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            Try to recover
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
