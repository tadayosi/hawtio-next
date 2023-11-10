import {
  Nav,
  NavItem,
  NavList,
  PageGroup,
  PageNavigation,
  PageSection,
  Popover,
  Text,
  TextContent,
  Title,
} from '@patternfly/react-core'
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons'
import React from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './Connect.css'
import { ConnectContext, useConnections } from './context'
import { Discover } from './discover/Discover'
import { pluginPath } from './globals'
import { ConnectLogin } from './login/ConnectLogin'
import { Remote } from './remote/Remote'

export const Connect: React.FunctionComponent = () => {
  const { connections, dispatch } = useConnections()
  const { pathname, search } = useLocation()

  const navItems = [
    { id: 'remote', title: 'Remote', component: Remote },
    { id: 'discover', title: 'Discover', component: Discover },
  ]

  const nav = (
    <Nav aria-label='Connect Nav' variant='tertiary'>
      <NavList>
        {navItems.map(({ id, title }) => (
          <NavItem key={id} isActive={pathname === `${pluginPath}/${id}`}>
            <NavLink to={{ pathname: id, search }}>{title}</NavLink>
          </NavItem>
        ))}
      </NavList>
    </Nav>
  )

  const routes = navItems.map(({ id, component }) => (
    <Route key={id} path={id} element={React.createElement(component)} />
  ))

  return (
    <ConnectContext.Provider value={{ connections, dispatch }}>
      <PageGroup>
        <PageSection id='connect-header' variant='light'>
          <Title id='connect-header-title' headingLevel='h1'>
            Connect <ConnectHint />
          </Title>
        </PageSection>
        <PageNavigation>{nav}</PageNavigation>
      </PageGroup>
      <PageSection id='connect-main'>
        <Routes>
          {routes}
          {/* connect/login should be hidden to nav */}
          <Route key='login' path='login' element={<ConnectLogin />} />
          <Route key='root' path='/' element={<Navigate to={navItems[0]?.id ?? ''} />} />
        </Routes>
      </PageSection>
    </ConnectContext.Provider>
  )
}

const ConnectHint: React.FunctionComponent = () => {
  const content = (
    <TextContent>
      <Text component='p'>
        This page allows you to connect to remote processes which{' '}
        <strong>
          already have a{' '}
          <a href='https://jolokia.org/agent.html' target='_blank' rel='noreferrer'>
            Jolokia agent
          </a>{' '}
          running inside them
        </strong>
        . You will need to know the host name, port and path of the Jolokia agent to be able to connect.
      </Text>
      <Text component='p'>
        If the process you wish to connect to does not have a Jolokia agent inside, please refer to the{' '}
        <a href='http://jolokia.org/agent.html' target='_blank' rel='noreferrer'>
          Jolokia documentation
        </a>{' '}
        for how to add a JVM, servlet, or OSGi based agent inside it.
      </Text>
      <Text component='p'>
        Some Java applications such as{' '}
        <a href='https://activemq.apache.org/components/artemis/' target='_blank' rel='noreferrer'>
          Apache ActiveMQ Artemis
        </a>{' '}
        include a Jolokia agent by default (use context path of Jolokia agent, usually <code>jolokia</code>). Or you can
        always just deploy Hawtio inside the process, which includes the Jolokia servlet agent (use Jolokia servlet
        mapping inside Hawtio context path, usually <code>hawtio/jolokia</code>).
      </Text>
    </TextContent>
  )

  return (
    <Popover
      aria-label='Connect hint popover'
      position='auto'
      hasAutoWidth
      maxWidth='60rem'
      bodyContent={content}
      removeFindDomNode
    >
      <OutlinedQuestionCircleIcon />
    </Popover>
  )
}
