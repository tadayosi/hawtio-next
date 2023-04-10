import { CamelImageIcon } from './CamelImageIcon'
import * as svg from './svg'

const elementMap: Map<string, JSX.Element> = new Map<string, JSX.Element>()

function buildIcon(name: string, svg: string, size: number) {
  return <CamelImageIcon name={name} svg={svg} size={size} />
}

// Populate the element map with the react rendered svg components
for (const [key, value] of Object.entries(svg)) {
  if (key === 'IconNames') {
    continue // not applicable
  }
  const iconName = key[0].toUpperCase() + key.substr(1) + 'Icon'
  elementMap.set(iconName, buildIcon(iconName, value, 16))
}

export const IconNames = svg.IconNames

export function getIcon(name: string): JSX.Element {
  const element: JSX.Element | undefined = elementMap.get(name)
  return element ? element : (elementMap.get(IconNames.GenericIcon) as JSX.Element)
}
