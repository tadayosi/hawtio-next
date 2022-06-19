import HawtioState from './state'
import reducer, { actions } from './reducer'

describe('reducer', () => {
  it('should do something on state', () => {
    let state = new HawtioState()
    expect(state.config).toBeUndefined
    state = reducer(state, actions.xxx({}))
    expect(state.config).not.toBeNull()
  })
})
