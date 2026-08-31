import { eventService } from '@hawtiosrc/core'
import { isRouteNode, isRoutesFolder } from '@hawtiosrc/plugins/camel/camel-service'
import { CamelContext } from '@hawtiosrc/plugins/camel/context'
import { CodeEditor, CodeEditorControl, Language } from '@patternfly/react-code-editor'
import { Alert } from '@patternfly/react-core'
import { SaveIcon } from '@patternfly/react-icons/dist/esm/icons/save-icon'
import React, { useContext, useEffect, useState } from 'react'
import { log } from '../globals'
import { routesService } from './routes-service'
import { useIsDarkTheme } from '@hawtiosrc/ui'

import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

loader.config({ monaco })

export const Source: React.FunctionComponent = () => {
  const { selectedNode } = useContext(CamelContext)
  const isDarkTheme = useIsDarkTheme()
  const [isUpdateEnabled, setIsUpdateEnabled] = useState(false)
  const [isWarningVisible, setIsWarningVisible] = useState(isUpdateEnabled)
  const [codeChanged, setCodeChanged] = useState(false)
  const isRoute: boolean = isRouteNode(selectedNode!) && !isRoutesFolder(selectedNode!)

  const xmlSource = selectedNode?.getMetadata('xml')
  if (selectedNode && !xmlSource) {
    log.warn('Source - Unable to fetch XML from', selectedNode)
  }

  useEffect(() => {
    if (!selectedNode) return

    if (isRoute) {
      routesService.isRouteUpdateEnabled(selectedNode).then(enabled => {
        setIsUpdateEnabled(enabled)
        setIsWarningVisible(enabled)
      })
    }
  }, [isRoute, selectedNode])

  //SelectedNode should be always selected when this view is routed
  if (!selectedNode) {
    return
  }

  const onCodeChange = (code: string) => {
    setCodeChanged(code !== xmlSource)
  }

  const onSaveClick = (code: string) => {
    if (isRoute && code !== xmlSource) {
      try {
        routesService.saveRoute(selectedNode, code)
        setCodeChanged(false)
        eventService.notify({
          type: 'success',
          message: 'Route was updated',
        })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        eventService.notify({ type: 'danger', message: 'Failed to save route' })
      }
    }
  }

  const saveButton = (
    <CodeEditorControl
      icon={<SaveIcon />}
      isVisible={isUpdateEnabled}
      aria-label='Save the changes'
      tooltipProps={{ content: codeChanged ? 'Save the changes' : 'Saved' }}
      isDisabled={!codeChanged}
      onClick={onSaveClick}
    />
  )

  /*
   * If consumers want to avoid the hardcoded 75vh value
   * of the height then this can override in CSS:
   *
   * #camel-source-editor {
   *   --hawtio-code-editor-height: 100%;
   * }
   */
  const editorHeight = () => {
    return 'var(--hawtio-source-code-editor-height, 75vh)'
  }

  return (
    <div id='camel-source-editor' style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1rem' }}>
      {isUpdateEnabled && isWarningVisible && (
        <Alert isInline isPlain variant='warning' title='The source update of the route is enabled' />
      )}

      <CodeEditor
        isDarkTheme={isDarkTheme}
        isReadOnly={!isUpdateEnabled}
        customControls={saveButton}
        code={xmlSource}
        language={Language.xml}
        isLanguageLabelVisible
        height={editorHeight()}
        onCodeChange={onCodeChange}
      />
    </div>
  )
}
