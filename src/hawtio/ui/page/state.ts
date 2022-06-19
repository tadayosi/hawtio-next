import React from 'react'

type Component = React.Component | React.FunctionComponent

export class Plugin {
  constructor(
    public name: string,
    public path: string,
    public component: Component) {
  }
}

export default class Plugins {
  readonly plugins: Plugin[] = []

  add(plugin: Plugin): Plugins {
    this.plugins.push(plugin)
    return this
  }
}
