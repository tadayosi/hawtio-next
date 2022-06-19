import { RouteComponentProps } from 'react-router-dom'
import { HawtioThunkDispatch } from '../reducer'

export type HawtioDispatchProps = {
  dispatch: HawtioThunkDispatch
}

export type HawtioRouteProps<T> = HawtioDispatchProps & RouteComponentProps<T>
