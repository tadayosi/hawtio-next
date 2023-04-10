export interface Connections {
  [key: string]: Connection
}

export interface Connection {
  name: string
  scheme: string
  host: string
  port: number
  path: string

  useProxy?: boolean
  jolokiaUrl?: string
  username?: string
  password?: string
  token?: string
}

export const ADD = 'ADD'
export const UPDATE = 'UPDATE'
export const DELETE = 'DELETE'
export const IMPORT = 'IMPORT'
export const RESET = 'RESET'

export type ConnectionsAction =
  | { type: typeof ADD; connection: Connection }
  | { type: typeof UPDATE; name: string; connection: Connection }
  | { type: typeof DELETE; name: string }
  | { type: typeof IMPORT; connections: Connection[] }
  | { type: typeof RESET }

function addConnection(state: Connections, connection: Connection): Connections {
  if (state[connection.name]) {
    // TODO: error handling
    return state
  }
  return { ...state, [connection.name]: connection }
}

function updateConnection(state: Connections, name: string, connection: Connection): Connections {
  if (name === connection.name) {
    // normal update
    if (!state[connection.name]) {
      // TODO: error handling
      return state
    }
    return { ...state, [connection.name]: connection }
  }

  // name change
  if (state[connection.name]) {
    // TODO: error handling
    return state
  }
  return Object.fromEntries(
    Object.entries(state).map(([k, v]) => (k === name ? [connection.name, connection] : [k, v])),
  )
}

function deleteConnection(state: Connections, name: string): Connections {
  const newState = { ...state }
  delete newState[name]
  return newState
}

export function reducer(state: Connections, action: ConnectionsAction): Connections {
  switch (action.type) {
    case ADD: {
      const { connection } = action
      return addConnection(state, connection)
    }
    case UPDATE: {
      const { name, connection } = action
      return updateConnection(state, name, connection)
    }
    case DELETE: {
      const { name } = action
      return deleteConnection(state, name)
    }
    case IMPORT: {
      const { connections } = action
      return connections.reduce((newState, conn) => addConnection(newState, conn), state)
    }
    case RESET:
      return {}
    default:
      return state
  }
}
