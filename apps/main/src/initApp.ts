import { AppManager } from './appManager'
export async function initApp() {
  const appManager = new AppManager()
  await appManager.init()
  return appManager
}
