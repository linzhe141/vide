import { createHashRouter } from 'react-router'
import RootLayout from '../layout/RootLayout'
import NotFound from './NotFound'
import { ErrorBoundary } from './ErrorBoundary'

export const router = createHashRouter([
  {
    Component: RootLayout,
    ErrorBoundary: ErrorBoundary,
    children: [
      {
        path: '/',
      },
    ],
  },
  {
    path: '*',
    Component: NotFound,
  },
])
