import { ConnectionTestResult, IConnectService } from '../connect-service'
import { Connection, Connections } from '../connections'

class MockConnectService implements IConnectService {
  constructor() {
    console.log('Using mock connect service')
  }

  getCurrentConnectionName(): string | null {
    return null
  }

  getCurrentConnection(): Connection | null {
    return null
  }

  loadConnections(): Connections {
    return {}
  }

  saveConnections(connections: Connections) {
    // no-op
  }

  getConnection(name: string): Connection | null {
    return null
  }

  connectionToUrl(connection: Connection): string {
    return ''
  }

  async checkReachable(connection: Connection): Promise<boolean> {
    return false
  }

  async testConnection(connection: Connection): Promise<ConnectionTestResult> {
    return { ok: false, message: '' }
  }

  connect(connection: Connection) {
    // no-op
  }

  getJolokiaUrl(connection: Connection): string {
    return ''
  }

  getJolokiaUrlFromName(name: string): string | null {
    return null
  }

  export(connections: Connections) {
    // no-op
  }
}

export const connectService = new MockConnectService()
