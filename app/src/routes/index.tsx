import { createHashRouter } from 'react-router'
import RootLayout from '../layout/RootLayout'
import NotFound from './NotFound'
import { ErrorBoundary } from './ErrorBoundary'

import { Welcome } from '../pages/welcome'

import { Layout as SettingsLayout } from '../pages/settings/layout'
import { GeneralSettings } from '../pages/settings/general'
import { LlmSettings } from '../pages/settings/llm'
import { Chat } from '../pages/chat'

export const router = createHashRouter([
  {
    Component: RootLayout,
    ErrorBoundary: ErrorBoundary,
    children: [
      {
        path: '/',
        Component: Welcome,
      },
      {
        path: '/chat/:id',
        Component: Chat
      },
      {
        path: '/settings',
        Component: SettingsLayout,
        children: [
          { index: true, Component: GeneralSettings },
          {
            path: 'llm',
            Component: LlmSettings,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    Component: NotFound,
  },
])
