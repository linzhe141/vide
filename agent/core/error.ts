export class AbortError extends Error {
  constructor() {
    super('aborted')
  }
}

export class ToolCallError extends Error {
  constructor(message: string) {
    super('tool call error')
    this.message = message
  }
}
