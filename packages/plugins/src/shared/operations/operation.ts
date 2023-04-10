import { isEmpty } from '@hawtio/react/util/objects'
import { stringSorter, trimEnd } from '@hawtio/react/util/strings'
import { IJmxOperation, IJmxOperations } from 'jolokia.js'

type OperationMap = { [name: string]: Operation }

export function createOperations(objectName: string, jmxOperations: IJmxOperations): Operation[] {
  const operations: Operation[] = []
  const operationMap: OperationMap = {}
  Object.entries(jmxOperations).forEach(([name, op]) => {
    if (Array.isArray(op)) {
      op.forEach(op => addOperation(operations, operationMap, name, op))
    } else {
      addOperation(operations, operationMap, name, op)
    }
  })
  operations.sort((a, b) => stringSorter(a.readableName, b.readableName))
  if (!isEmpty(operationMap)) {
    fetchPermissions(operationMap, objectName)
  }

  return operations
}

function addOperation(operations: Operation[], operationMap: OperationMap, name: string, op: IJmxOperation): void {
  const operation = new Operation(
    name,
    op.args.map(arg => new OperationArgument(arg.name, arg.type, arg.desc)),
    op.desc,
  )
  operations.push(operation)
  operationMap[operation.name] = operation
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fetchPermissions(operationMap: OperationMap, objectName: string) {
  // TODO: impl fetch permissions
}

export class Operation {
  readonly name: string
  readonly readableName: string
  canInvoke: boolean

  constructor(method: string, readonly args: OperationArgument[], readonly description: string) {
    this.name = this.buildName(method)
    this.readableName = this.buildReadableName(method)
    this.canInvoke = true
  }

  private buildName(method: string): string {
    return method + '(' + this.args.map(arg => arg.type).join() + ')'
  }

  private buildReadableName(method: string): string {
    return method + '(' + this.args.map(arg => arg.readableType).join(', ') + ')'
  }
}

export class OperationArgument {
  readonly readableType: string

  constructor(readonly name: string, readonly type: string, readonly desc: string) {
    this.readableType = this.buildReadableType()
  }

  private buildReadableType(): string {
    const lastDotIndex = this.type.lastIndexOf('.')
    let answer = lastDotIndex > 0 ? this.type.substring(lastDotIndex + 1) : this.type
    if (this.type.startsWith('[') && this.type.endsWith(';')) {
      answer = trimEnd(answer, ';') + '[]'
    }
    return answer
  }

  helpText(): string {
    let help = this.desc
    if (help && help !== this.name) {
      if (help.charAt(help.length - 1) !== '.') {
        help = help + '.'
      }
    } else {
      help = ''
    }
    return `${help} Type: ${this.readableType}`
  }
}
