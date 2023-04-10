import React, { useContext, useEffect, useState } from 'react'
import { CodeEditor, Language } from '@patternfly/react-code-editor'
import { CamelContext } from '__root__/camel/context'

export const Source: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const [xmlSource, setxmlSource] = useState<string>('')

  useEffect(() => {
    const xml = selectedNode?.getProperty('xml')
    if (xml) {
      setxmlSource(xml)
    } else {
      console.log('Unable to fetch XML')
    }
  }, [selectedNode])

  return (
    <div>
      <CodeEditor isReadOnly code={xmlSource} language={Language.xml} height='500px' />
    </div>
  )
}
