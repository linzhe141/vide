import './foo.css'

type DemoWindowRole = 'main' | 'foo'

type MultiWindowDemoMessage = {
  source: DemoWindowRole
  target: DemoWindowRole
  message: string
  sentAt: string
}

const roleParam = new URLSearchParams(window.location.search).get('role')
const role: DemoWindowRole = roleParam === 'main' ? 'main' : 'foo'

const title = document.querySelector<HTMLHeadingElement>('#window-title')
const roleText = document.querySelector<HTMLParagraphElement>('#window-role')
const messageState = document.querySelector<HTMLParagraphElement>('#message-state')
const closeWindowButton = document.querySelector<HTMLButtonElement>('#close-window')
const sendHelloButton = document.querySelector<HTMLButtonElement>('#send-hello')
const sendDoneButton = document.querySelector<HTMLButtonElement>('#send-done')
const sendSyncButton = document.querySelector<HTMLButtonElement>('#send-sync')
const clearLogButton = document.querySelector<HTMLButtonElement>('#clear-log')
const messageLog = document.querySelector<HTMLUListElement>('#message-log')

if (
  !title ||
  !roleText ||
  !messageState ||
  !closeWindowButton ||
  !sendHelloButton ||
  !sendDoneButton ||
  !sendSyncButton ||
  !clearLogButton ||
  !messageLog
) {
  throw new Error('multi-window demo DOM bootstrap failed')
}

const logElement = messageLog
const messageStateElement = messageState

title.textContent = `foo.html / ${role}`
roleText.textContent =
  'Foo window. Click a button below and the main renderer card will update through IPC.'
messageStateElement.textContent = 'Waiting for main 点击了...'

appendLog({
  source: role,
  target: role,
  message: `Window booted at ${new Date().toLocaleTimeString()}`,
  sentAt: new Date().toISOString(),
})

window.ipcRendererApi.invoke('multi-window-demo-send', {
  source: 'foo',
  target: 'main',
  message: 'foo ready',
})

closeWindowButton.addEventListener('click', () => {
  window.ipcRendererApi.invoke('close-current-window')
})

sendHelloButton.addEventListener('click', () => {
  sendToMain('foo 点击了 hello')
})

sendDoneButton.addEventListener('click', () => {
  sendToMain('foo 点击了 done')
})

sendSyncButton.addEventListener('click', () => {
  sendToMain('foo 点击了 sync')
})

clearLogButton.addEventListener('click', () => {
  messageLog.innerHTML = ''
})

window.ipcRendererApi.on('multi-window-demo-message', (payload) => {
  messageStateElement.textContent = `收到 ${payload.source}: ${payload.message}`
  appendLog(payload)
})

function sendToMain(message: string) {
  window.ipcRendererApi.invoke('multi-window-demo-send', {
    source: 'foo',
    target: 'main',
    message,
  })
  messageStateElement.textContent = `已发送给 main: ${message}`
}

function appendLog(payload: MultiWindowDemoMessage) {
  const item = document.createElement('li')
  item.className = 'demo-log-item'

  const meta = document.createElement('p')
  meta.className = 'demo-log-meta'
  meta.textContent = `${formatTime(payload.sentAt)} · ${payload.source} -> ${payload.target}`

  const text = document.createElement('p')
  text.className = 'demo-log-message'
  text.textContent = payload.message

  item.append(meta, text)
  logElement.prepend(item)
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString()
}
