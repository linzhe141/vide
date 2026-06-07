export class AbortError extends Error {
  constructor() {
    super('aborted')
  }
}

export class RecoverableError extends Error {
  constructor(message: string) {
    super(message)
  }
}
