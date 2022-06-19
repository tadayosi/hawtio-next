import { Action } from 'redux'
import { ThunkAction, ThunkDispatch } from 'redux-thunk'
import actionCreatorFactory from 'typescript-fsa'
import { reducerWithInitialState } from 'typescript-fsa-reducers'
import HawtioState from './state'

export type HawtioThunkAction = ThunkAction<Promise<void>, HawtioState, any, Action<any>>
export type HawtioThunkDispatch = ThunkDispatch<HawtioState, any, Action<any>>

const actionCreator = actionCreatorFactory('hawtio')

export const actions = {
  xxx: actionCreator<{}>('XXX')
}

function xxx(state: HawtioState): HawtioState {
  return { ...state, config: {} }
}

const reducer = reducerWithInitialState(new HawtioState())
  .case(actions.xxx, xxx)

export default reducer
