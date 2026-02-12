import { hawtio, usePlugins } from '@hawtiosrc/core'
import { CardBody, Content, Nav, NavItem, NavList, PageGroup, PageSection, Title } from '@patternfly/react-core'
import React, { useMemo } from 'react'
import Markdown from 'react-markdown'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import help from './help.md'
import { helpRegistry } from './registry'

helpRegistry.add('home', 'Home', help, 1)

export const HawtioHelp: React.FunctionComponent = () => {
  const { pathname, search } = useLocation()
  const { plugins } = usePlugins()

  const helps = useMemo(() => {
    const pluginIds = hawtio.getPlugins().map(p => p.id)
    const activePlugins = plugins.map(p => p.id)
    return helpRegistry.getHelps().filter(help => {
      if (pluginIds.includes(help.id)) {
        return activePlugins.includes(help.id)
      }
      return true
    })
  }, [plugins])

  return (
    <PageGroup id='hawtio-help'>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel='h1'>Help</Title>
      </PageSection>
      <PageSection type='tabs' hasBodyWrapper={false}>
        <Nav aria-label='Help Nav' variant='horizontal-subnav'>
          <NavList>
            {helps.map(help => (
              <NavItem key={help.id} isActive={pathname === `/help/${help.id}`}>
                <NavLink to={{ pathname: help.id, search }}>{help.title}</NavLink>
              </NavItem>
            ))}
          </NavList>
        </Nav>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <Routes>
          {helpRegistry.getHelps().map(({ id, content }) => (
            <Route
              key={id}
              path={id}
              element={
                <CardBody>
                  <Content>
                    <Markdown>{content}</Markdown>
                  </Content>
                </CardBody>
              }
            />
          ))}
          <Route path='/' element={<Navigate to={{ pathname: 'home', search }} />} />
        </Routes>
      </PageSection>
    </PageGroup>
  )
}
