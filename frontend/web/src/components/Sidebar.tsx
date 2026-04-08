import React from 'react'

type Page = 'workflows' | 'harness-agent'

type Props = {
  current: Page
  onChange: (page: Page) => void
}

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'workflows',     label: 'Workflows',     icon: '⚡' },
  { id: 'harness-agent', label: 'Harness Agent',  icon: '🖥' },
]

export function Sidebar({ current, onChange }: Props): React.JSX.Element {
  return (
    <aside style={{
      width: 200,
      flexShrink: 0,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0',
    }}>
      {/* Logo */}
      <div style={{
        padding: '0 20px 20px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 8,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', letterSpacing: '0.03em' }}>
          OpenHarness
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Agent Console
        </div>
      </div>

      {/* Nav items */}
      {NAV.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 20px',
            background: current === id ? 'var(--bg-card)' : 'transparent',
            borderRadius: 0,
            border: 'none',
            borderLeft: `2px solid ${current === id ? 'var(--accent)' : 'transparent'}`,
            color: current === id ? 'var(--text)' : 'var(--text-muted)',
            textAlign: 'left',
            fontSize: 13,
            fontWeight: current === id ? 600 : 400,
            transition: 'background 0.1s, color 0.1s',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 15 }}>{icon}</span>
          {label}
        </button>
      ))}
    </aside>
  )
}

export type { Page }
