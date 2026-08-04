import { Session } from "./session"

export class Agent {
  get settings() {
    return {}
  }

  createSession() {
    return new Session()
  }
}
