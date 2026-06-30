import { AppManager } from './appManager'
export function initApp() {
  const appManager = new AppManager()
  appManager.init()
}
