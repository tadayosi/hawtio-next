# Hawtio - overview for developers and AI Assistants

This file presents what is Hawtio and what are irs architectural parts.

## What is Hawtio - high level overview

Hawtio was built to bring the Java JMX layer to web applications. Each running JVM process includes Java MBeans
registered in JMX registry which allows to _invoke JMX operations_, _access JMX attributes_ and _be notified
about JMX notifications_.

[Jolokia](https://jolokia.org) provides a REST/JSON access to JMX MBeans without using
non-web-friendly protocols originally used by JMX (like RMI) and Hawtio leverages this web-friendly access layer
(an _adapter_).

Having JMX MBeans accessible using JSON-based protocol, Hawtio web application can easily present the MBean
information in web interface using variety of web components (like the ones provided by React / Patternfly).

## GitHub repositories of Hawtio

From more technical perspective, "Hawtio" is just a product/brand name for several components running in different
areas (client, server) and here's a list of GitHub repositories which constitute "Hawtio". More details about
the functionality provided by these separate projects can be found in the following paragraphs.

- "Hawtio React" (this GitHub repository): `@hawtio/react` NPM package. This is a JavaScript _library_ built from
  TypeScript source code which provides the main React/Patternfly components for web UI of Hawtio. This package is
  located in `./packages/hawtio/` directory, however this repository contains some other NPM packages and sample
  applications using this _main_ NPM package.
- "Hawtio Java" (https://github.com/hawtio/hawtio): The _original_ location of Hawtio which provides the Java
  backend/server-side components for running Hawtio in different environments (Spring Boot, Quarkus, JakartaEE
  Servlet Container) and providing integration with Jolokia agent.
- "Jolokia" (https://github.com/jolokia/jolokia): The repository for Jolokia agent which provides REST/JSON
  "JMX Adapter" for Java Management Extension (JMX) technology.
- "Hawtio Online" (https://github.com/hawtio/hawtio-online): This repository provides web application and a node.js
  based _gateway_ to be used in OpenShift/Kubernetes environments. UI application is used to access Jolokia-enabled
  OpenShift/Kubernetes pods/services and lets users to connect to selected pod, effectively running the "Hawtio React"
  application for accessing selected Jolokia-enabled JVM running in the cluster.

## Two backends used by Hawtio React application

Hawtio React application is running as React/Patternfly web application in user's web browser and in general, uses
**two** server backends:

1. A web server hosting the HTMl, JavaScript, CSS, font and image resources which constitute Hawtio React application
2. A web server providing a "Jolokia" endpoint (usually mapped to `/jolokia/*` URI, but can be something like
   `/actuator/jolokia/*` for Spring Boot Actuator deployment). Which activates the JMX functionality of Hawtio React.

A special, but in fact most common scenario is where these two "servers" are just one server used both for serving
static resources (HTML, JS, CSS, ...) and providing a `/jolokia/*` REST/JSON endpoint.

Additionally, whether or not the original web server (which serves static resources) provides `/jolokia/*` endpoint
or not, Hawtio React can connect to other remote web servers which **only** provide the `/jolokia/*` REST/JSON
endpoint. We call it "Remote Jolokia Agent". To make the picture complete - such additional remote Jolokia agent's
`/jolokia/*` endpoint may be provided by Jolokia itself or be part of another Hawtio Java application (in such case
the _serving_ part of this remote web server is not used).

### Java based web server for Hawtio React

"Hawtio Java" provides 3 kinds of deployments of server side components for serving static resources for Hawtio
React web application and own `/jolokia/*` endpoint:

- Jakarta EE Servlet Container application - to be deployed to servers like Jetty or Tomcat
- Spring Boot application - using Spring MVC
- Quarkus application - using Quarkus/vert.x

Because Jolokia agent is a REST/JSON layer on top of JMX, having a Java server for "serving" Hawtio React web
application is easier to use and more powerful in terms of security, performance and resource usage.

In "Hawtio Java" repository, a `console` Maven module contains `package.json` file and is a JavaScript
_application_ built using webpack, importing NPM `@hawtio/react` package and calling `ReactDOM.createRoot()` and
`root.render()`.

### JavaScript based web server for Hawtio React

Hawtio React web application can be served from any web server, including node.js/express.js setup. In this case
there's no way to provide a _real_ `/jolokia.*` endpoint from such server - we can only mock it.

This GitHub repository provides a sample web application in `./app/` directory based on `webpack-dev-server` which
serves the purpose of testing the `@hawtio/react` NPM package (from `./packages/hawtio/`) and showing how
`@hawtio/react` package should be used.

Knowing what `./app/` is, the clear distinction is:

- `./packages/hawtio/` is a JavaScript _library_ (built from TypeScript using tsup/esbuild) providing React/Patternfly
  components, including the _main_ component named `<Hawtio>`.
- `./app/` is a JavaScript \_application (built from TypeScript using webpack) calling `ReactDOM.createRoot()` and
  `root.render()` - this is a JavaScript equivalent of the above mentioned `console` Maven module in Hawtio Java.

### Proxy Servlet

When the static Hawtio React resources are served from one web server (either Java or JavaScript based), the running
Hawtio React web application can access previously mentioned Remote Jolokia Agents. For CORS purposes, this remote
access is not performed directly by using browser's `fetch()` API directly to the Remote Jolokia Agent, but is
proxies via the server from which the static Hawtio React resources are served. The component which does the proxying
is called Proxy Servlet.

- Java implementation of this Proxy Servlet is included in Hawtio Java repository
- JavaScript implementation of this Proxy servlet is included in this repository in the form of
  `@hawtio/backend-middleware` NPM package.

### Auxiliary endpoints

In addition to these 3 functionalities:

- serving static HTML, CSS, JS, image resources
- providing `/jolokia/*` endpoint
- providing Proxy Servlet endpoint

Hawtio backed (whether Java or JavaScript based) provides some additional _endpoints_ for configuration and metadata.
These endpoints include:

- authentication and session information: `/auth/config/*`
- form-based login: `/auth/login` and `/auth/logout`
- plugin information: `/plugin/*`
- information about currently logged in user: `/user/*`

## Security

With different backend types (serving static resources, providing `/jolokia/*` endpoint) and various technologies
(Java, JavaScript) we may have different security requirements and possibilities.

### Authentication and Authorization - general information

Neither JavaScript nor Java web server that serves static Hawtio React resources protect these resources by enforcing
authentication/authorization.

However the `/jolokia/*` endpoint (whether served by the serving web server or Remote Jolokia Agent) _may_ enforce
authentication/authorization.

It is easier to configure authentication when the web server is Java based:

- for JakartaEE Servlet Container, we use JAAS technology with `AuthenticationFilter` declared in `WEB-INF/web.xml`
- for Spring Boot deployment, we use Spring Security integrated (bridged to) JAAS
- for Quarkus deployment we use Quarkus-specific authentication mechanisms (no JAAS is involved)

From Hawtio React perspective, the requests (performed using `fetch()` API) may carry the authentication information
in two different ways:

- with `JSESSIONID` cookie after the session is initialized with successful login information
- with `Authorization: Bearer <token>` when OIDC login was used in Hawtio React

Hawtio React web application, during initialization calls (using `fetch()` API) `/user/*` endpoint to check
whether the server side (whether it's Java or JavaScript based) know about currently logged in user. If Hawtio
React doesn't send any `Authorization` header or `JSESSIONID` cookie, there's no way for the server side to tell
there's someone logged in.

In case `/user/*` endpoint returns `null`, Hawtio React renders `<HawtioLogin>` React component instead of
normal `<Hawtio>` component. `<HawtioLogin>` then uses `/auth/config/*` endpoint to configure the login screen,
possibly presenting multiple login options - including OIDC login or form-based login.

### Authentication using form login

When user is not authenticated and Hawtio React displays form login for authentication, the credentials are processed
by the server side `/auth/login` endpoint. Different deployment methods may use different technologies for
actual authentication (including JAAS) and from Hawtio React perspective the successful authentication results in:

- `/user/*` endpoint returning non-null username
- a cookie being set which allows consecutive `fetch()` API requests to be treated as _authenticated_.

### Authentication using OIDC

If the server side configures Hawtio React application (through `/auth/config/*` endpoint) that OIDC authentication
is enabled, user of Hawtio React is presented with non-form login screen with just one button - which triggers
OAuth2 Authorization Code Grant flow (RFC 6749). It involves redirection to OIDC provider like Keycloak.

From Hawtio React perspective, Successful OIDC authentication results in:

- `/user/*` endpoint returning non-null username (as with form login)
- an OIDC JWT access, id and refresh tokens being available to Hawtio React application, which are then
  added to `Authorization: Bearer <token>` header for each `fetch()` API call

## Camel plugin

The Camel plugin (`packages/hawtio/src/plugins/camel/`) uses the
[`@hawtio/camel-model`](https://www.npmjs.com/package/@hawtio/camel-model) npm package to obtain the
EIP/component schema that drives the route diagram and properties panels.

### `@hawtio/camel-model` versioning policy

**Policy: support the two most recent active Camel LTS versions.**
(Discussed in [hawtio-react#693](https://github.com/hawtio/hawtio-react/issues/693))

Apache Camel publishes two LTS releases per year; each is supported for one year.
Hawtio tracks the two currently active LTS lines and ships one bundled model package per LTS line.

As of October 2026 the two active LTS lines are:

| Camel LTS line | npm alias in `package.json` | npm package version | Support ends |
| -------------- | --------------------------- | ------------------- | ------------ |
| 4.22 LTS       | `@hawtio/camel-model-v4_22` | `~4.22.1`           | 2027-08-11   |
| 4.18 LTS       | `@hawtio/camel-model-v4_18` | `~4.18.5`           | 2027-02-17   |

**Non-LTS Camel releases (e.g. 4.19, 4.20, 4.21, 4.23) are intentionally not supported.**
Users running a non-LTS version will be served the model of the nearest older LTS line.

### How the model is selected at runtime

`getCamelModel(node)` in `camel-service.ts` reads the `CamelVersion` JMX attribute from the running
Camel context and returns the appropriate bundled model:

```
Camel 4.22+ => @hawtio/camel-model-v4_22
Camel 4.0+  => @hawtio/camel-model-v4_18  (fallback for 4.0–4.21 and unknown versions)
```

See `camel-service.ts` → `getCamelModel()` for the current implementation.
