import { Link } from 'react-router'
import { Button } from '../ui/Button'

export default function NotFound() {
  return (
    <div className='bg-background flex h-screen w-full items-center justify-center px-6'>
      <div className='max-w-lg text-center'>
        {/* 404 插画 */}
        <div className='mb-8 flex justify-center'>
          <div className='relative'>
            {/* 背景光晕 */}
            <div className='bg-primary/20 absolute inset-0 animate-pulse rounded-full blur-3xl'></div>

            {/* 404 数字 */}
            <div className='relative'>
              <h1 className='text-foreground/10 text-9xl font-bold'>404</h1>
              <div className='absolute inset-0 flex items-center justify-center'>
                <svg
                  className='text-primary h-24 w-24'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 错误信息 */}
        <div className='mb-8'>
          <h2 className='text-foreground mb-3 text-3xl font-bold'>Page Not Found</h2>
          <p className='text-text-secondary text-lg'>
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* 操作按钮 */}
        <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-center'>
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
                  d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
                />
              </svg>
              Go Home
            </Link>
          </Button>

          <Button
            onClick={() => window.history.back()}
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
                  d='M10 19l-7-7m0 0l7-7m-7 7h18'
                />
              </svg>
              Go Back
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
