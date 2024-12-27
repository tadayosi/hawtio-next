import Jolokia, { IJolokiaSimple } from '@jolokia.js/simple'
import 'jolokia.js'
import {
  ConnectStatus,
  Connection,
  ConnectionCredentials,
  ConnectionTestResult,
  Connections,
  IConnectService,
  LoginResult,
} from '../connect-service'

class MockConnectService implements IConnectService {
  constructor() {
    // eslint-disable-next-line no-console
    console.log('Using mock connect service')
  }

  getCurrentConnectionId(): string | null {
    return null
  }

  getCurrentConnectionName(): string | null {
    return null
  }

  async getCurrentConnection(): Promise<Connection | null> {
    return null
  }

  async getCurrentCredentials(): Promise<ConnectionCredentials | null> {
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

  async checkReachable(connection: Connection): Promise<ConnectStatus> {
    return 'not-reachable'
  }

  async testConnection(connection: Connection): Promise<ConnectionTestResult> {
    return { status: 'not-reachable', message: '' }
  }

  connect(connection: Connection) {
    // no-op
  }

  async login(username: string, password: string): Promise<LoginResult> {
    return { type: 'failure' }
  }

  redirect() {
    // no-op
  }

  createJolokia(connection: Connection, checkCredentials?: boolean): IJolokiaSimple {
    return new Jolokia('/jolokia')
  }

  getJolokiaUrl(connection: Connection): string {
    return ''
  }

  getJolokiaUrlFromId(name: string): string | null {
    return null
  }

  getLoginPath(): string {
    return ''
  }

  export(connections: Connections) {
    // no-op
  }
}

export const connectService = new MockConnectService()
