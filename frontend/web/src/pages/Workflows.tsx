import React, { useRef, useState, useCallback } from 'react'
import type { BackendEvent, Message } from '../types.ts'

const PERMISSION_MODES = [
  { value: 'full_auto', label: 'Full Auto — allow all tools' },
  { value: 'default',   label: 'Default — ask before writes' },
  { value: 'plan',      label: 'Plan — read-only, no writes' },
]

function useWorkflowStream() {
  const [messages, setMessages] = useState<Message[]>([])
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (prompt: string, permissionMode: string) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setBusy(true)
    setMessages([{ role: 'user', text: prompt }])

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, output_format: 'stream-json', permission_mode: permissionMode }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            handleEvent(JSON.parse(trimmed) as BackendEvent)
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : String(err)
        setMessages(prev => [...prev, { role: 'error', text: msg }])
      }
    } finally {
      setBusy(false)
    }
  }, [])

  const handleEvent = (ev: BackendEvent) => {
    if (ev.type === 'assistant_delta' && ev.message) {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last.streaming) {
          return [...prev.slice(0, -1), { ...last, text: last.text + ev.message! }]
        }
        return [...prev, { role: 'assistant', text: ev.message!, streaming: true }]
      })
    } else if (ev.type === 'transcript_item' && ev.item) {
      const { role, text, tool_name } = ev.item
      if (role === 'tool') {
        setMessages(prev => [...prev, { role: 'tool', text, toolName: tool_name }])
      } else if (role === 'assistant' && text.trim()) {
        // finalise streamed assistant block or add new one
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, text, streaming: false }]
          }
          return [...prev, { role: 'assistant', text, streaming: false }]
        })
      }
    } else if (ev.type === 'error' && ev.message) {
      setMessages(prev => [...prev, { role: 'error', text: ev.message! }])
    }
  }

  const stop = () => abortRef.current?.abort()

  return { messages, busy, run, stop }
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }): React.JSX.Element {
  const isUser = msg.role === 'user'
  const isTool = msg.role === 'tool'
  const isError = msg.role === 'error'

  const borderColor = isUser ? 'var(--blue)' : isTool ? 'var(--orange)' : isError ? 'var(--red)' : 'var(--border)'

  return (
    <div style={{
      borderLeft: `2px solid ${borderColor}`,
      paddingLeft: 12,
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 11,
        color: isUser ? 'var(--blue)' : isTool ? 'var(--orange)' : isError ? 'var(--red)' : 'var(--accent)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 4,
        fontWeight: 600,
      }}>
        {isUser ? 'You' : isTool ? `⚙ ${msg.toolName ?? 'tool'}` : isError ? 'Error' : 'Agent'}
      </div>
      <pre style={{
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: isError ? 'var(--red)' : 'var(--text)',
        fontSize: 13,
        lineHeight: 1.6,
        opacity: isTool ? 0.7 : 1,
      }}>
        {msg.text}
        {msg.streaming && (
          <span style={{ animation: 'blink 1s step-end infinite', color: 'var(--accent)' }}>▌</span>
        )}
      </pre>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Workflows(): React.JSX.Element {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('full_auto')
  const { messages, busy, run, stop } = useWorkflowStream()
  const bottomRef = useRef<HTMLDivElement>(null)

  // auto-scroll
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = () => {
    if (prompt.trim() && !busy) {
      run(prompt.trim(), mode)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24, gap: 16 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Workflows</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Send a prompt to the harness agent and stream the response.
        </p>
      </div>

      {/* Input form */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter a prompt… (Ctrl+Enter to run)"
          disabled={busy}
          rows={4}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={mode}
            onChange={e => setMode(e.target.value)}
            disabled={busy}
            style={{ padding: '6px 10px', borderRadius: 6, fontSize: 13 }}
          >
            {PERMISSION_MODES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {busy ? (
            <button
              onClick={stop}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: '1px solid var(--red)',
                color: 'var(--red)',
                background: 'transparent',
                fontWeight: 600,
              }}
            >
              ■ Stop
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!prompt.trim()}
              style={{
                padding: '6px 20px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--accent)',
                color: '#000',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              ▶ Run
            </button>
          )}

          {busy && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--accent)' }}>●</span> Running…
            </span>
          )}
        </div>
      </div>

      {/* Response stream */}
      {messages.length > 0 && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 20,
        }}>
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Cursor blink keyframe — injected once */}
      <style>{`@keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }`}</style>
    </div>
  )
}
