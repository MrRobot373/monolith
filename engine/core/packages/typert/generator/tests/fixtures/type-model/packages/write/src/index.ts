import { Service } from '@monolith/cordis'

/** Service whose public annotations are intentionally absent. */
export class WritableService extends Service {
  value = 1

  echo(input = 'value') {
    return input
  }
}

declare module '@monolith/cordis' {
  interface Context {
    writable: WritableService
  }
}

export default WritableService
