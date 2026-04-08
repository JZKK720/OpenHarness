import React from 'react'

// ttyd URL — configurable via VITE_TTYD_URL at build time.
// Defaults to localhost:8681 (the oh-web service exposed port).
const TTYD_URL = (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_TTYD_URL ?? 'http://localhost:8681'

export function HarnessAgent(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, display: 'inline', marginRight: 10 }}>
            Harness Agent
          </h1>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Interactive <code style={{ fontFamily: 'var(--font-mono)' }}>oh</code> REPL via ttyd
          </span>
        </div>

        <a
          href={TTYD_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 12,
            color: 'var(--blue)',
            textDecoration: 'none',
            padding: '4px 10px',
            border: '1px solid var(--blue)',
            borderRadius: 5,
            opacity: 0.8,
          }}
        >
          ↗ Open in new tab
        </a>
      </div>

      {/* Embedded terminal */}
      <iframe
        src={TTYD_URL}
        title="OpenHarness Agent Terminal"
        style={{
          flex: 1,
          border: 'none',
          width: '100%',
          background: '#1e1e2e',
        }}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}
