import React, { ChangeEvent } from 'react'
import { Button, Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem, TreeViewSearch } from '@patternfly/react-core'

interface ToolbarProps {
  onSearch: (event: ChangeEvent<HTMLInputElement>) => void
  onSetExpanded: (newExpanded: boolean) => void
}

export const PluginTreeViewToolbar = (props: ToolbarProps) => {
  const onSearch = (event: ChangeEvent<HTMLInputElement>) => {
    if (props.onSearch) {
      props.onSearch(event)
    }
  }

  const toggleExpanded = (expand: boolean) => {
    if (props.onSetExpanded) {
      props.onSetExpanded(expand)
    }
  }

  return (
    <Toolbar style={{ padding: 0 }}>
      <ToolbarContent style={{ padding: 0 }}>
        <ToolbarGroup variant='filter-group'>
          <ToolbarItem>
            <TreeViewSearch
              onSearch={onSearch}
              id='input-search'
              name='search-input'
              aria-label='Search input example'
            />
          </ToolbarItem>
          <ToolbarItem variant='expand-all' style={{ paddingRight: '0.5rem' }}>
            <Button size='sm' variant='control' aria-label='Expand Collapse' onClick={() => toggleExpanded(true)}>
              Expand all
            </Button>
            <Button size='sm' variant='control' aria-label='Expand Collapse' onClick={() => toggleExpanded(false)}>
              Collapse all
            </Button>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  )
}
