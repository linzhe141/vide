import { isRouteErrorResponse, Link } from 'react-router'
import { Button } from '../ui/Button'

export function ErrorBoundary({ error }: any) {
  console.log(error)

  if (isRouteErrorResponse(error)) {
    return (
      <div className='bg-background flex h-screen w-full items-center justify-center px-6'>
        <div className='max-w-md text-center'>
          {/* 错误图标 */}
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
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                />
              </svg>
            </div>
          </div>

          {/* 错误信息 */}
          <h1 className='text-foreground mb-2 text-6xl font-bold'>{error.status}</h1>
          <h2 className='text-foreground mb-4 text-2xl font-semibold'>{error.statusText}</h2>
          <p className='text-text-secondary mb-8'>{error.data}</p>

          {/* 返回按钮 */}
          <Button className='group'>
            <Link to='/' className='flex items-center gap-2'>
              <svg
                className='h-4 w-4 transition-transform group-hover:-translate-x-1'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M10 19l-7-7m0 0l7-7m-7 7h18'
                />
              </svg>
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    )
  } else if (error instanceof Error) {
    return (
      <div className='bg-background flex min-h-screen w-full items-center justify-center px-6 py-12'>
        <div className='w-full max-w-3xl'>
          {/* 错误图标 */}
          <div className='mb-8 flex justify-center'>
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
                  d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
            </div>
          </div>

          {/* 错误标题 */}
          <div className='mb-8 text-center'>
            <h1 className='text-foreground mb-2 text-3xl font-bold'>Something went wrong</h1>
            <p className='text-text-secondary'>An unexpected error occurred</p>
          </div>

          {/* 错误详情卡片 */}
          <div className='border-border bg-background mb-6 rounded-2xl border p-6 shadow-sm'>
            <h2 className='text-text-info mb-3 text-sm font-semibold tracking-wide uppercase'>
              Error Message
            </h2>
            <p className='bg-primary/5 text-foreground rounded-lg p-4 font-mono text-sm'>
              {error.message}
            </p>
          </div>

          {/* 堆栈跟踪 */}
          {error.stack && (
            <details className='group border-border bg-background mb-8 rounded-2xl border shadow-sm'>
              <summary className='text-text-info hover:text-foreground cursor-pointer p-6 text-sm font-semibold tracking-wide uppercase transition-colors'>
                <span className='inline-flex items-center gap-2'>
                  <svg
                    className='h-4 w-4 transition-transform group-open:rotate-90'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                    strokeWidth={2}
                  >
                    <path strokeLinecap='round' strokeLinejoin='round' d='M9 5l7 7-7 7' />
                  </svg>
                  Stack Trace
                </span>
              </summary>
              <div className='border-border border-t p-6'>
                <pre className='bg-primary/5 text-text-secondary overflow-x-auto rounded-lg p-4 text-xs'>
                  {error.stack}
                </pre>
              </div>
            </details>
          )}

          {/* 操作按钮 */}
          <div className='flex flex-col items-center gap-4 sm:flex-row sm:justify-center'>
            <Button className='group w-full sm:w-auto'>
              <Link to='/' className='flex items-center gap-2'>
                <svg
                  className='h-4 w-4 transition-transform group-hover:-translate-x-1'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M10 19l-7-7m0 0l7-7m-7 7h18'
                  />
                </svg>
                Go Home
              </Link>
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className='border-border bg-background text-foreground hover:bg-border/50 w-full border sm:w-auto'
            >
              <span className='flex items-center gap-2'>
                <svg
                  className='h-4 w-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                  />
                </svg>
                Reload Page
              </span>
            </Button>
          </div>
        </div>
      </div>
    )
  } else {
    return (
      <div className='bg-background flex h-screen w-full items-center justify-center px-6'>
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
          <Button className='group'>
            <Link to='/' className='flex items-center gap-2'>
              <svg
                className='h-4 w-4 transition-transform group-hover:-translate-x-1'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M10 19l-7-7m0 0l7-7m-7 7h18'
                />
              </svg>
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    )
  }
}
