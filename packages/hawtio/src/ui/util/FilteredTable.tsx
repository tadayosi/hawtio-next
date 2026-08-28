import { isNumber, objectSorter } from '@hawtiosrc/util/objects'
import {
  Bullseye,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  FormGroup,
  MenuToggle,
  MenuToggleElement,
  Pagination,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Toolbar,
  ToolbarContent,
  ToolbarFilter,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core'
import { SearchIcon } from '@patternfly/react-icons/dist/esm/icons/search-icon'
import { Table, Tbody, Td, Th, Thead, ThProps, Tr } from '@patternfly/react-table'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ExpandableText } from './ExpandableText'
import './FilteredTable.css'

interface Props<T> {
  extraToolbarLeft?: React.ReactNode
  extraToolbarRight?: React.ReactNode
  tableColumns: {
    name?: string
    key?: keyof T
    renderer?: (value: T) => React.ReactNode
    isAction?: boolean
    percentageWidth?: ThProps['width']
    hideValues?: string[]
  }[]
  rows: T[]
  fixedSearchCategories?: {
    key: keyof T
    name: string
    values: string[]
    id?: string
    ariaLabel?: string
    renderer?: (value: string) => React.ReactNode
  }[]
  searchCategories: { name: string; key: keyof T }[]
  onClick?: (value: T) => void
  onClearAllFilters?: () => void
  highlightSearch?: boolean
  classPrefix?: string
}

function numberOrString(value: unknown): string | number {
  if (isNumber(value)) {
    return Number(value)
  } else {
    return String(value)
  }
}

export function FilteredTable<T>({
  extraToolbarLeft,
  extraToolbarRight,
  tableColumns,
  rows,
  fixedSearchCategories,
  searchCategories,
  onClick,
  onClearAllFilters,
  classPrefix,
  highlightSearch = false,
}: Props<T>) {
  const defaultSearchCategory = searchCategories[0]?.key

  const [filters, setFilters] = useState<{ key?: keyof T; value: string; name: string }[]>([])
  const [searchTerm, setSearchTerm] = useState<{ key?: keyof T; value: string }>({
    key: defaultSearchCategory,
    value: '',
  })
  const [filteredRows, setFilteredRows] = useState<T[]>([])

  const [attributeMenuItem, setAttributeMenuItem] = useState<{ name: string; key: keyof T } | null>(() => {
    if (searchCategories[0]) {
      return { key: searchCategories[0].key, name: searchCategories[0].name }
    }
    return null
  })

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isFixedDropdownOpen, setIsFixedDropdownOpen] = useState<Map<keyof T, boolean>>(() => {
    const fixedSearchDropdownMap = new Map<keyof T, boolean>()

    fixedSearchCategories?.forEach(category => {
      fixedSearchDropdownMap.set(category.key, false)
    })

    return fixedSearchDropdownMap
  })

  const [sortIndex, setSortIndex] = useState<number>(-1)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    let filtered: T[] = [...rows]

    // add current searchTerm and filter
    const fs = [...filters, searchTerm]
    fs.forEach(filter => {
      const key = filter.key
      if (!key) {
        return
      }
      const searchTerm = filter.value
      filtered = filtered.filter(value => {
        return String(value[key]).toLowerCase().includes(searchTerm.toLowerCase())
      })
    })

    // If user is filtering - refreshing the threads themselves would reset the page count
    if (filtered.length != rows.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(1)
    }
    setFilteredRows([...filtered])
  }, [rows, searchTerm, attributeMenuItem, filters])

  const getValuesForDisplay = useCallback(
    (item: T): (string | number)[] => {
      return tableColumns.map(({ key }) => numberOrString(key && item[key]))
    },
    [tableColumns],
  )

  const sortedFilteredRows = useMemo(() => {
    let sortedThreads = filteredRows
    if (sortIndex >= 0) {
      sortedThreads = filteredRows.sort((a, b) => {
        const aValue = getValuesForDisplay(a)[sortIndex]
        const bValue = getValuesForDisplay(b)[sortIndex]
        return objectSorter(aValue, bValue, sortDirection === 'desc')
      })
    }
    return sortedThreads
  }, [filteredRows, sortDirection, sortIndex, getValuesForDisplay])

  const clearFilters = () => {
    onClearAllFilters?.()
    setFilters([])
    setSearchTerm({
      key: searchTerm.key,
      value: '',
    })
  }

  const addToFilters = () => {
    if (searchTerm.value !== '' && attributeMenuItem) {
      setFilters([...filters, { ...searchTerm, name: attributeMenuItem.name }])
      setSearchTerm({ key: searchTerm.key, value: '' })
    }
  }

  const getRowPage = () => {
    const start = (page - 1) * perPage
    const end = start + perPage
    return filteredRows.slice(start, end)
  }

  const propsPagination = (
    <Pagination
      itemCount={filteredRows.length}
      page={page}
      perPage={perPage}
      onSetPage={(_evt, value) => setPage(value)}
      onPerPageSelect={(_evt, value) => {
        setPerPage(value)
        setPage(1)
      }}
      variant='top'
    />
  )

  const filterDropdownItems = searchCategories.map(category => (
    <DropdownItem key={`search-key-${category.name}`} onClick={() => setAttributeMenuItem(category)}>
      {category.name}
    </DropdownItem>
  ))

  const getFilterChips = () => {
    const chips = filters.map(({ name, value }) => `${name}: ${value}`)
    if (searchTerm.value) {
      chips.push(`${attributeMenuItem?.name}: ${searchTerm.value}`)
    }

    return chips
  }

  const onDeleteFilter = (filter: string) => {
    if (filter === `${attributeMenuItem?.name}: ${searchTerm.value}`) {
      setSearchTerm({
        key: attributeMenuItem?.key,
        value: '',
      })
    } else {
      const newFilters = filters.filter(f => `${f.name}: ${f.value}` !== filter)
      setFilters(newFilters)
    }
  }

  const tableToolBar = (
    <Toolbar clearAllFilters={clearFilters}>
      <ToolbarContent>
        {extraToolbarLeft}

        {fixedSearchCategories?.map(category => (
          <ToolbarFilter
            id={category.id || String(category.key) + '-toolbar'}
            categoryName={category.name}
            key={category.id || String(category.key) + '-toolbar'}
          >
            <Select
              id={(category.id || String(category.key) + '-toolbar') + '-select'}
              aria-label={category.ariaLabel || category.name}
              selected={filters.filter(filter => filter.key === category.key).map(filter => filter.value)}
              isOpen={isFixedDropdownOpen.get(category.key)}
              onOpenChange={() => {
                isFixedDropdownOpen.set(category.key, !isFixedDropdownOpen.get(category.key))
                setIsFixedDropdownOpen(new Map(isFixedDropdownOpen))
              }}
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  role='menu'
                  ref={toggleRef}
                  onClick={() => {
                    isFixedDropdownOpen.set(category.key, !isFixedDropdownOpen.get(category.key))
                    setIsFixedDropdownOpen(new Map(isFixedDropdownOpen))
                  }}
                >
                  {category.name}
                </MenuToggle>
              )}
              onSelect={(event?: React.MouseEvent<Element, MouseEvent>, value?: string | number) => {
                const checked = (event?.target as HTMLInputElement).checked

                if (checked) {
                  setFilters([...filters, { key: category.key, value: String(value), name: category.name }])
                } else {
                  setFilters([
                    ...filters.filter(filter => !(filter.key === category.key && filter.value === String(value))),
                  ])
                }
              }}
            >
              <SelectList>
                {category.values.map((value, index) => (
                  <SelectOption
                    hasCheckbox
                    key={index}
                    value={value}
                    isSelected={filters
                      .filter(filter => filter.key === category.key)
                      .map(filter => filter.value)
                      .includes(value)}
                  >
                    {category.renderer?.(value) ?? value}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </ToolbarFilter>
        ))}
        {extraToolbarLeft}
        <ToolbarGroup>
          {searchCategories.length > 1 && (
            <Dropdown
              data-testid='attribute-select'
              onSelect={() => {
                setIsDropdownOpen(false)
                addToFilters()
              }}
              onOpenChange={setIsDropdownOpen}
              defaultValue='Name'
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  ref={toggleRef}
                  data-testid='attribute-select-toggle'
                  id='toggle-basic'
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {attributeMenuItem?.name}
                </MenuToggle>
              )}
              isOpen={isDropdownOpen}
            >
              <DropdownList>{filterDropdownItems}</DropdownList>
            </Dropdown>
          )}
          <ToolbarFilter
            labels={getFilterChips()}
            deleteLabel={(_e, filter) => onDeleteFilter(filter as string)}
            deleteLabelGroup={clearFilters}
            categoryName='Filters'
            className={(classPrefix && classPrefix + '-') + 'searchToolbar'}
          >
            <SearchInput
              key='table-search-input'
              type='text'
              data-testid='filter-input'
              id='search-input'
              placeholder='Search...'
              value={searchTerm.value}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.code.includes('Enter') || e.keyCode === 13) {
                  addToFilters()
                }
              }}
              onChange={(_event, value) => setSearchTerm({ key: attributeMenuItem?.key, value })}
              aria-label='Search input'
            />
          </ToolbarFilter>
        </ToolbarGroup>

        {extraToolbarRight}

        <ToolbarItem variant='pagination'>{propsPagination}</ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  )

  const getSortParams = (sortColumn: number): ThProps['sort'] | undefined => {
    if (tableColumns[sortColumn]?.name && tableColumns[sortColumn]?.key) {
      return {
        sortBy: {
          index: sortIndex,
          direction: sortDirection,
          defaultDirection: 'asc', // starting sort direction when first sorting a column. Defaults to 'asc'
        },
        onSort: (_event, index, direction) => {
          setSortIndex(index)
          setSortDirection(direction)
        },
        columnIndex: sortColumn,
      }
    }
    return undefined
  }

  const highlightSearchedText = (text: string, search: string) => {
    if (search === '') {
      return text
    }

    const lowerCaseSearch = search.toLowerCase()
    const res = text
      .split(new RegExp(`(${search})`, 'gi'))
      .map((s, i) => (s.toLowerCase() === lowerCaseSearch ? <mark key={i}>{s}</mark> : s))
    return res
  }

  const defaultCellRenderer = (data: (string | number)[], row: number, column: number, hideText?: string[]) => {
    let text: React.ReactNode = data[column]
    if (hideText && hideText.includes(String(text))) {
      text = ''
    }
    if (highlightSearch) {
      text = highlightSearchedText(
        String(text),
        [...filters, searchTerm]
          .filter(f => f.key === tableColumns[column]?.key)
          .map(f => f.value)
          .join('|'),
      )
    }
    return <ExpandableText key={'col' + row + '-' + column + '-value'}>{text}</ExpandableText>
  }

  return (
    <Panel>
      <PanelHeader>{tableToolBar}</PanelHeader>
      <PanelMain>
        <PanelMainBody>
          {sortedFilteredRows.length > 0 && (
            <FormGroup>
              <Table aria-label='Message Table' variant='compact' height='80vh' isStriped isStickyHeader>
                <Thead>
                  <Tr>
                    {tableColumns.map((att, index) => (
                      <Th
                        key={'th-key' + index}
                        data-testid={`${String(att.key || index)}-header`}
                        sort={getSortParams(index)}
                        width={att.percentageWidth}
                      >
                        {att.name}
                      </Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {getRowPage().map((item, index) => {
                    const values = getValuesForDisplay(item)
                    return (
                      <Tr key={'row' + index} data-testid={'row' + index} onClick={() => onClick?.(item)}>
                        {tableColumns.map(({ renderer, hideValues, isAction }, column) => (
                          <Td key={'col' + index + '-' + column} isActionCell={isAction}>
                            {renderer ? renderer(item) : defaultCellRenderer(values, index, column, hideValues)}
                          </Td>
                        ))}
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </FormGroup>
          )}
          {sortedFilteredRows.length === 0 && (
            <Bullseye>
              <EmptyState icon={SearchIcon}>
                <EmptyStateBody>No results found.</EmptyStateBody>
              </EmptyState>
            </Bullseye>
          )}
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
