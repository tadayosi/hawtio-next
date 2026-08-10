import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { HawtioLogin } from './HawtioLogin'

describe('HawtioLogin', () => {
  beforeEach(() => {
    fetchMock.mockResponse('')
  })

  test('renders page', async () => {
    render(
      <BrowserRouter>
        <HawtioLogin />
      </BrowserRouter>,
    )
    await waitFor(() => {
      const example = screen.queryByText('Log in to your account')
      expect(example).toBeInTheDocument()
    })
  })
})
