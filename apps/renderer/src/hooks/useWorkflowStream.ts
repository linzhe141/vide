import { useCallback, useRef, useState } from 'react'
import { createWorkflowStream, resumeWorkflowStream } from './createWorkflowStream'
import { useSessionStoreActions } from '../store/sessionStore'

export function useWorkflowStream() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)
  const [running, setRunning] = useState(false)
  const { handleEvent } = useSessionStoreActions()

  const cleanup = () => {
    readerRef.current?.cancel().catch(() => {})
    readerRef.current = null
    abortControllerRef.current = null
  }

  const send = useCallback(
    async (sessionId: string, input: string) => {
      setRunning(true)
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const stream = createWorkflowStream(abortController.signal)
      const reader = stream.getReader()
      readerRef.current = reader

      try {
        window.ipcRendererApi.invoke('agent-session-send', {
          sessionId,
          input,
        })
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (!value) continue
          handleEvent(value)
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error(err)
        }
      } finally {
        setRunning(false)
        reader.releaseLock()
        cleanup()
      }
    },
    [handleEvent]
  )

  const resumeRunningWorkflow = useCallback(
    async (sessionId: string, workflowId: string) => {
      setRunning(true)
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const stream = resumeWorkflowStream(sessionId, workflowId, abortController.signal)
      const reader = stream.getReader()
      readerRef.current = reader

      try {
        window.ipcRendererApi.invoke('resume-running-workflow', {
          sessionId,
          workflowId,
        })
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (!value) continue
          handleEvent(value)
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error(err)
        }
      } finally {
        setRunning(false)
        reader.releaseLock()
        cleanup()
      }
    },
    [handleEvent]
  )

  // useEffect(() => {
  //   const remove = window.ipcRendererApi.on('agent-session-background-send', async (data) => {
  //     const sessionId = data.sessionId
  //     setRunning(true)
  //     const abortController = new AbortController()
  //     abortControllerRef.current = abortController
  //     const stream = createBackgroundPromptWorkflowStream(sessionId, abortController.signal)
  //     const reader = stream.getReader()
  //     readerRef.current = reader

  //     try {
  //       while (true) {
  //         const { value, done } = await reader.read()
  //         if (done) break
  //         if (!value) continue
  //         handleEvent(value)
  //       }
  //     } catch (err: any) {
  //       if (err?.name !== 'AbortError') {
  //         console.error(err)
  //       }
  //     } finally {
  //       setRunning(false)
  //       reader.releaseLock()
  //       cleanup()
  //     }
  //   })
  //   return remove
  // }, [handleEvent])

  const abort = useCallback(async () => {
    abortControllerRef.current?.abort()
    // 通知主进程真正中断 agent 的运行中的 workflow
  }, [])

  return {
    send,
    abort,
    resumeRunningWorkflow,
    running,
  }
}
