// Mirrors frontend/terminal/src/types.ts — keep in sync with BackendEvent

export type TranscriptItem = {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'tool_result' | 'log'
  text: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  is_error?: boolean
}

export type BackendEvent = {
  type: string
  message?: string | null
  item?: TranscriptItem | null
  tool_name?: string | null
  output?: string | null
  is_error?: boolean | null
}

// Internal UI message shape
export type Message = {
  role: 'user' | 'assistant' | 'tool' | 'error'
  text: string
  toolName?: string
  streaming?: boolean
}
