import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/ui/Button'
import { SettingsIcon } from 'lucide-react'
import { Input } from '@/ui/Input'
import { Alert } from '@/ui/Alert'
import { useElectronSettingStore } from '@/store/electronSettingStore'
import type { GenerateImageConfig } from '@vide/config'
import { useRef, useCallback, useEffect } from 'react'

export function useAutoDismiss<T>(duration = 3000) {
  const [state, setState] = useState<T | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const show = useCallback(
    (value: T) => {
      clearTimer()
      setState(value)

      timerRef.current = setTimeout(() => {
        setState(null)
        timerRef.current = null
      }, duration)
    },
    [duration, clearTimer]
  )

  const hide = useCallback(() => {
    clearTimer()
    setState(null)
  }, [clearTimer])

  // 防止组件卸载时 timer 泄漏
  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return {
    state,
    show,
    hide,
  }
}

export function GenerateImageSettings() {
  const { generateImageConfig, setGenerateImageConfig } = useElectronSettingStore()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GenerateImageConfig>({
    defaultValues: generateImageConfig,
  })

  const { state: verificationResult, show: showResult } = useAutoDismiss<{
    success: boolean
    message: string
  }>(3000)

  // Save
  const onSave = async (data: GenerateImageConfig) => {
    setGenerateImageConfig(data)

    showResult({
      success: true,
      message: 'Settings saved successfully',
    })
    window.ipcRendererApi.invoke('submit-generate-image-settings', data)
  }

  return (
    <div className='mx-auto max-w-3xl px-6 py-12'>
      {/* Header */}
      <div className='mb-8 flex items-center gap-3'>
        <div className='bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl'>
          <SettingsIcon className='text-primary h-6 w-6' />
        </div>
        <div>
          <h1 className='text-foreground text-3xl font-bold'>Settings</h1>
          <p className='text-muted-foreground'>Configure your Generate Image API settings</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSave)}
        className='bg-card border-border space-y-6 rounded-2xl border p-8'
      >
        {/* API Key */}
        <div className='space-y-2'>
          <label className='text-foreground text-sm font-medium'>API Key</label>
          <Input
            type='password'
            placeholder='sk-...'
            {...register('apiKey', { required: 'API Key is required' })}
          />
          {errors.apiKey && <p className='text-xs text-red-500'>{errors.apiKey.message}</p>}
        </div>

        {/* Base URL */}
        <div className='space-y-2'>
          <label className='text-foreground text-sm font-medium'>Base URL</label>
          <Input
            type='url'
            placeholder='https://api.openai.com'
            {...register('baseUrl', { required: 'Base URL is required' })}
          />
          {errors.baseUrl && <p className='text-xs text-red-500'>{errors.baseUrl.message}</p>}
        </div>

        {/* Model */}
        <div className='space-y-2'>
          <label className='text-foreground text-sm font-medium'>Model</label>
          <Input
            type='text'
            placeholder='gpt-4'
            {...register('model', { required: 'Model is required' })}
          />
          {errors.model && <p className='text-xs text-red-500'>{errors.model.message}</p>}
        </div>

        {verificationResult && (
          <Alert variant={verificationResult.success ? 'success' : 'fail'}>
            {verificationResult.message}
          </Alert>
        )}

        {/* Actions */}
        <div className='flex items-center gap-3 pt-4'>
          <Button type='submit'>Save Settings</Button>
        </div>
      </form>
    </div>
  )
}
