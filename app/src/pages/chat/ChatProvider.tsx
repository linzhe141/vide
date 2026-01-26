import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type PropsWithChildren,
} from 'react'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import { useThreadStore } from '../../store/threadStore'
import { context } from '../../hooks/chatContenxt'
import type { ChatMessage } from '@/agent/core/types'

interface ChatContextType {
  // State
  input: string
  setInput: (value: string) => void
  approvedToolCalls: Set<string>
  showToBottomButton: boolean
  placeholderRef: React.RefObject<HTMLDivElement | null>

  // From useWorkflowStream
  send: (message: string) => Promise<void>
  isAborted: boolean
  isFinished: boolean
  abort: () => void
  isRunning: boolean

  // From useThreadStore
  messages: ChatMessage[]

  // Actions
  handleSend: () => Promise<void>
  handleApprove: (id: string) => void
  handleReject: () => void
  toBottom: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: PropsWithChildren) {
  const { messages } = useThreadStore()
  const [input, setInput] = useState('')
  const { send, isAborted, isFinished, abort, isRunning } = useWorkflowStream()
  const [approvedToolCalls, setApprovedCalls] = useState<Set<string>>(new Set())
  const placeholderRef = useRef<HTMLDivElement>(null)
  const [showToBottomButton, setShowToBottomButton] = useState(false)

  useEffect(() => {
    const firstInput = context.firstInput
    if (firstInput) {
      console.log('firstInput', firstInput)
      context.firstInput = ''
      send(firstInput)
    }
  }, [send])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setShowToBottomButton(!entry.isIntersecting)
        })
      },
      { threshold: 0.5 }
    )
    if (placeholderRef.current) {
      observer.observe(placeholderRef.current)
    }
    return () => observer.disconnect()
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isRunning) return
    await send(input)
    setInput('')
  }

  const handleApprove = (id: string) => {
    setApprovedCalls((prev) => new Set(prev).add(id))
    window.ipcRendererApi.invoke('agent-human-approved')
  }

  const handleReject = () => {}

  const toBottom = () => {
    placeholderRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const value: ChatContextType = {
    input,
    setInput,
    approvedToolCalls,
    showToBottomButton,
    placeholderRef,
    send,
    isAborted,
    isFinished,
    abort,
    isRunning,
    messages,
    handleSend,
    handleApprove,
    handleReject,
    toBottom,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}
