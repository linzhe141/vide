import { useState, useEffect } from 'react'
import { Button } from '@/app/src/ui/Button'
import { SettingsIcon } from 'lucide-react'
import { Input } from '@/app/src/ui/Input'
import { Alert } from '@/app/src/ui/Alert'

export function LlmSettings() {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Load settings from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('llm_api_key') || ''
    const savedBaseUrl = localStorage.getItem('llm_base_url') || ''
    const savedModel = localStorage.getItem('llm_model') || ''
    setApiKey(savedApiKey)
    setBaseUrl(savedBaseUrl)
    setModel(savedModel)
  }, [])

  // Save settings to localStorage
  const handleSave = () => {
    localStorage.setItem('llm_api_key', apiKey)
    localStorage.setItem('llm_base_url', baseUrl)
    localStorage.setItem('llm_model', model)
    setVerificationResult({
      success: true,
      message: 'Settings saved successfully',
    })
    setTimeout(() => setVerificationResult(null), 3000)
  }

  // Verify API connection
  const handleVerify = async () => {
    setVerifying(true)
    setVerificationResult(null)

    try {
      // Simple validation
      if (!apiKey || !baseUrl || !model) {
        setVerificationResult({
          success: false,
          message: 'Please fill in all fields',
        })
        setVerifying(false)
        return
      }

      // Test API connection
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      if (response.ok) {
        setVerificationResult({
          success: true,
          message: 'API connection verified successfully',
        })
      } else {
        setVerificationResult({
          success: false,
          message: `Verification failed: ${response.statusText}`,
        })
      }
    } catch (error) {
      setVerificationResult({
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div>
      <div className='mx-auto max-w-3xl px-6 py-12'>
        {/* Header */}
        <div className='mb-8 flex items-center gap-3'>
          <div className='bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl'>
            <SettingsIcon className='text-primary h-6 w-6' />
          </div>
          <div>
            <h1 className='text-foreground text-3xl font-bold'>Settings</h1>
            <p className='text-muted-foreground'>
              Configure your LLM API settings
            </p>
          </div>
        </div>

        {/* Settings Form */}
        <div className='bg-card border-border space-y-6 rounded-2xl border p-8'>
          {/* API Key */}
          <div className='space-y-2'>
            <label className='text-foreground text-sm font-medium'>
              API Key
            </label>
            <Input
              type='password'
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder='sk-...'
            />
            <p className='text-muted-foreground text-xs'>
              Your LLM provider API key
            </p>
          </div>

          {/* Base URL */}
          <div className='space-y-2'>
            <label className='text-foreground text-sm font-medium'>
              Base URL
            </label>
            <Input
              type='url'
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder='https://api.openai.com'
            />
            <p className='text-muted-foreground text-xs'>
              The API endpoint URL
            </p>
          </div>

          {/* Model */}
          <div className='space-y-2'>
            <label className='text-foreground text-sm font-medium'>Model</label>
            <Input
              type='text'
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder='gpt-4'
            />
            <p className='text-muted-foreground text-xs'>
              The model name to use for chat completions
            </p>
          </div>
          {verificationResult && (
            <Alert variant={verificationResult.success ? 'success' : 'fail'}>
              {verificationResult.message}
            </Alert>
          )}

          {/* Action Buttons */}
          <div className='flex items-center gap-3 pt-4'>
            <Button
              onClick={handleVerify}
              disabled={verifying}
              variant='outline'
            >
              {verifying ? 'Verifying...' : 'Verify Connection'}
            </Button>
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>

        {/* Info Card */}
        <div className='bg-muted/50 border-border mt-6 rounded-2xl border p-6'>
          <h3 className='text-foreground mb-2 text-sm font-semibold'>
            Configuration Guide
          </h3>
          <ul className='text-muted-foreground space-y-1 text-sm'>
            <li>• Enter your API key from your LLM provider</li>
            <li>• Set the base URL (e.g., https://api.openai.com)</li>
            <li>• Specify the model name (e.g., gpt-4, claude-3-opus)</li>
            <li>• Click "Verify Connection" to test the configuration</li>
            <li>• Save your settings to use them in chat</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
