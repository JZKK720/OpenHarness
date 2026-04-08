import React, { useState } from 'react'
import { Sidebar, type Page } from './components/Sidebar.tsx'
import { Workflows } from './pages/Workflows.tsx'
import { HarnessAgent } from './pages/HarnessAgent.tsx'

export default function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>('workflows')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar current={page} onChange={setPage} />

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {page === 'workflows'     && <Workflows />}
        {page === 'harness-agent' && <HarnessAgent />}
      </main>
    </div>
  )
}
