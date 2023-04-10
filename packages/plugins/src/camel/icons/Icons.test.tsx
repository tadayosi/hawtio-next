import { render, screen } from '@testing-library/react'
import { IconNames, getIcon } from './Icons'

describe('svg-icons', () => {
  test('getIcon', async () => {
    const icon1: JSX.Element = getIcon(IconNames.AggregateIcon)
    const icon2: JSX.Element = getIcon(IconNames.GenericIcon)
    const icon3: JSX.Element = getIcon(IconNames.RouteIcon)
    const icon4: JSX.Element = getIcon(IconNames.EndpointsNodeIcon)

    render(icon1)
    render(icon2)
    render(icon3)
    render(icon4)

    expect(screen.getByAltText(IconNames.AggregateIcon)).toBeInTheDocument()
    expect(screen.getByAltText(IconNames.GenericIcon)).toBeInTheDocument()
    expect(screen.getByAltText(IconNames.RouteIcon)).toBeInTheDocument()
    expect(screen.getByAltText(IconNames.EndpointsNodeIcon)).toBeInTheDocument()
  })
})
