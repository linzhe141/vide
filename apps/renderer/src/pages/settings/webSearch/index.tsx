import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { SearchIcon } from 'lucide-react'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { useSetWebSearchConfig, useWebSearchConfig } from '@/store/electronSettingStore'
import type { WebSearchConfig } from '@vide/config'

export function WebSearchSettings() {
  const webSearchConfig = useWebSearchConfig()
  const setWebSearchConfig = useSetWebSearchConfig()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WebSearchConfig>({
    defaultValues: webSearchConfig,
  })

  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)

  const onSave = async (data: WebSearchConfig) => {
    setWebSearchConfig(data)
    setSaveResult({
      success: true,
      message: 'Settings saved successfully',
    })
  }

  return (
    <div className='mx-auto max-w-3xl px-6 py-12'>
      <div className='mb-8 flex items-center gap-3'>
        <div className='bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl'>
          <SearchIcon className='text-primary h-6 w-6' />
        </div>
        <div>
          <h1 className='text-foreground text-3xl font-bold'>Settings</h1>
          <p className='text-muted-foreground'>Configure your Serper web search settings</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSave)}
        className='bg-card border-border space-y-6 rounded-2xl border p-8'
      >
        <div className='space-y-2'>
          <label className='text-foreground text-sm font-medium'>Search URL</label>
          <Input
            type='url'
            placeholder='https://google.serper.dev/search'
            {...register('searchUrl', { required: 'Search URL is required' })}
          />
          {errors.searchUrl && <p className='text-xs text-red-500'>{errors.searchUrl.message}</p>}
        </div>

        <div className='space-y-2'>
          <label className='text-foreground text-sm font-medium'>API Key</label>
          <Input
            type='password'
            placeholder='Serper API key'
            {...register('apiKey', { required: 'API Key is required' })}
          />
          {errors.apiKey && <p className='text-xs text-red-500'>{errors.apiKey.message}</p>}
        </div>

        {saveResult && (
          <Alert variant={saveResult.success ? 'success' : 'fail'}>{saveResult.message}</Alert>
        )}

        <div className='flex items-center gap-3 pt-4'>
          <Button type='submit'>Save Settings</Button>
        </div>
      </form>
    </div>
  )
}
