import { createHashRouter } from 'react-router'
import RootLayout from '../layout/RootLayout'
import NotFound from './NotFound'
import { ErrorBoundary } from './ErrorBoundary'

import { Welcome } from '../pages/welcome'

import { Layout as SettingsLayout } from '../pages/settings/layout'
import { GeneralSettings } from '../pages/settings/general'
import { GenerateImageSettings } from '../pages/settings/generateImage'
import { Chat } from '../pages/chat'
import { LlmSettings } from '../pages/settings/llm'
import { WebSearchSettings } from '../pages/settings/webSearch'
import { WechatBotSettings } from '../pages/settings/wechat'
import { GitHubAuthSettings } from '../pages/settings/github'
import { SkillsPage } from '../pages/skills'

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
        Component: Chat,
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
          {
            path: 'generateImage',
            Component: GenerateImageSettings,
          },
          {
            path: 'webSearch',
            Component: WebSearchSettings,
          },
          {
            path: 'wechat',
            Component: WechatBotSettings,
          },
          {
            path: 'github',
            Component: GitHubAuthSettings,
          },
        ],
      },
      {
        path: '/skills',
        Component: SkillsPage,
      },
    ],
  },
  {
    path: '*',
    Component: NotFound,
  },
])
