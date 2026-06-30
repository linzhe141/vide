import { Link } from 'react-router'
import { Button } from '../ui/Button'

export function ErrorBoundary({ error }: any) {
  console.log(error)

  return (
    <div className='bg-background drag-region flex h-screen w-full items-center justify-center px-6'>
      <div className='max-w-md text-center'>
        {/* 未知错误图标 */}
        <div className='mb-6 flex justify-center'>
          <div className='bg-primary/10 flex h-20 w-20 items-center justify-center rounded-full'>
            <svg
              className='text-primary h-10 w-10'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
          </div>
        </div>

        {/* 未知错误标题 */}
        <h1 className='text-foreground mb-4 text-3xl font-bold'>Unknown Error</h1>
        <p className='text-text-secondary mb-8'>
          We encountered an unexpected error. Please try returning to the home page.
        </p>

        {/* 返回按钮 */}
        <Button className='group no-drag-region'>
          <Link to='/' className='flex items-center gap-2'>
            <svg
              className='h-4 w-4 transition-transform group-hover:-translate-x-1'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}
            >
              <path strokeLinecap='round' strokeLinejoin='round' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
            Go Home
          </Link>
        </Button>
      </div>
    </div>
  )
}
