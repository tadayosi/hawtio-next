# Hawtio Extension Design

> Created: 2026-10  
> Related issues: [hawtio-ai-plugin#60](https://github.com/hawtio/hawtio-ai-plugin/issues/60) | [hawtio-react#2080](https://github.com/hawtio/hawtio-react/issues/2080)

## Background

The Hawtio AI plugin is provided as a standalone view. There is a requirement to **embed AI functionality directly inside existing plugin views** — for example, adding a button to the JMX Attributes view that runs an AI diagnosis against the selected MBean.

Implementing this requires a mechanism to **inject UI components into arbitrary locations from an external plugin, without a direct import between the plugins**.

## Existing Mechanism: `headerItems` / `UniversalHeaderItem`

The current approach allows plugins to contribute components to the header toolbar via `Plugin.headerItems`.

```ts
// core/core.ts
export interface UniversalHeaderItem {
  component: React.ComponentType<any>
  universal: boolean // true = always visible / false = visible only when the plugin is active
}
export type HeaderItem = React.ComponentType | UniversalHeaderItem

export type Plugin = {
  headerItems?: HeaderItem[]
  // ...
}
```

`HawtioHeader.tsx` renders all `headerItems` whose plugin path matches the current URL, plus all entries marked `universal: true`.

**Limitations:**

- Components can only be injected into the **header** — not into view bodies.
- There is no way to pass props to the injected component.

## Design

### Concept

- A **slot ID (string)** identifies each extension point.
- The **host plugin** (e.g. JMX) places `<HawtioExtensionSlot id='jmx-attributes-toolbar' />` in its view.
- The **extension plugin** (e.g. AI plugin) calls `hawtio.addExtension('jmx-attributes-toolbar', { component, pluginId, order })` to register.
- The two plugins are coupled only by the slot ID string — no direct import is required.

### Architecture

```
┌─ @hawtio/react core ─────────────────────────────────────────────────────────────┐
│  extensionRegistry (internal / Map<slotId, ExtensionEntry[]>)                    │
│  hawtio.addExtension(slotId, entry)  ← public API                                │
│  <HawtioExtensionSlot id='...' props={...} />                                    │
└──────────────────────────────────────────────────────────────────────────────────┘
         ▲ register                                         ▼ declare
┌─ AI plugin ──────────────────────────────┐     ┌─ JMX plugin ────────────────────┐
│ hawtio.addExtension(                     │     │ <HawtioExtensionSlot            │
│   'jmx-attributes-toolbar',              │     │   id='jmx-attributes-toolbar'   │
│   { component, pluginId, order },        │     │   props={{ node }}              │
│ )                                        │     │ />                              │
└──────────────────────────────────────────┘     └─────────────────────────────────┘
```

### Public API

```ts
// IHawtio / HawtioCore (core/core.ts)
hawtio.addExtension<TProps>(slotId: string, entry: ExtensionEntry<TProps>): void
```

`extensionRegistry` is an internal implementation detail and is not exported. All external access goes through `hawtio.addExtension()`, which centralises lifecycle control (bootstrap timing warning, future plugin-unload cleanup).

### Implemented Files

#### `core/extension-registry.ts` (new — internal)

```ts
export interface ExtensionEntry<TProps = Record<string, unknown>> {
  component: React.ComponentType<TProps>
  /** ID of the registering plugin. Used by `removeByPlugin` for bulk cleanup on plugin unload. */
  pluginId: string
  /** Display order within the slot (ascending). Defaults to 100. */
  order?: number
}
```

The `ExtensionRegistry` class exposes `add`, `get` (sorted by `order`), `removeByPlugin`, and `reset`. Only `ExtensionEntry` (the type) is re-exported from `core/index.ts`; the `extensionRegistry` singleton is not.

#### `ui/extension/HawtioExtensionSlot.tsx` (new)

```tsx
export function HawtioExtensionSlot<TProps extends Record<string, unknown>>({
  id,
  props,
}: {
  id: string
  props?: TProps
}) {
  if (!preferencesService.isExtensionsEnabled()) return null

  const entries = extensionRegistry.get(id)
  if (entries.length === 0) return null

  return (
    <>
      {entries.map(({ component: C }, i) => (
        <C key={i} {...(props as Record<string, unknown>)} />
      ))}
    </>
  )
}
```

Returns `null` when extensions are disabled in Preferences, or when no components are registered for the slot. The `function` declaration form is used (rather than a `const` arrow) to avoid the TSX generic tag parsing ambiguity.

## Lifecycle

### Phases

```
Phase 1: LOADING
  - bootstrap() runs addDeferredPlugin() loaders in parallel.
  - hawtio.addExtension() should be called within these loaders.
  - UI is not rendered yet (loading screen is shown).

Phase 2: READY
  - All plugin loaders have completed.
  - extensionRegistry is frozen. Calling addExtension() after this logs a warning.
  - HawtioPage renders. All extensions are guaranteed to be registered by this point.
  - HawtioExtensionSlot reads the registry once at mount — no subscription or re-render is needed.

Phase 3: EXIT
  - On logout, a full page reload or window.close() occurs in all current code paths.
  - JS memory (including extensionRegistry) is cleared automatically.
  - removeByPlugin() is retained for future SPA-style reconnect scenarios.
```

### Integration with `bootstrap()`

`HawtioCore` sets a `bootstrapped` flag when `configManager.ready()` resolves. Any `addExtension()` call after this point logs a warning, alerting the developer that the extension may be registered too late to be included in the initial render.

```ts
// Recommended pattern: call addExtension() inside the deferred loader
hawtio.addDeferredPlugin('ai-plugin', async () => {
  const m = await import('./ai')
  hawtio.addExtension('jmx-attributes-toolbar', {
    component: m.AiButton,
    pluginId: 'ai-plugin',
  })
  return { id: 'ai-plugin', ... }
})
```

### EXIT Phase

All current logout paths end with either `window.location.href = PATH_LOGOUT` (page reload) or `window.close()`, so `extensionRegistry` memory is cleared automatically. `removeByPlugin()` is implemented and retained for future use (e.g. SPA-style reconnection without a full page reload), but is not called anywhere in the current codebase.

## Security Model

### Principle: loaded plugins are trusted

> If an untrusted plugin injecting arbitrary components were considered a threat,
> all JS running on the same origin would be equally untrusted — including any npm package
> or webpack bundle. Treating plugins as a special threat is inconsistent with the broader model.

The trust boundary is at the point of deciding whether to load a plugin at all.

| Layer                              | Mechanism                                         |
| ---------------------------------- | ------------------------------------------------- |
| CDN / Module Federation URLs       | HTTPS + `integrity` (SRI)                         |
| npm packages                       | `yarn.lock` / npm provenance                      |
| `hawtconfig.json` `disabledRoutes` | Route suppression (not code execution prevention) |

### Preferences opt-out

Users can globally disable extensions via a Preferences toggle. Registration and rendering are intentionally separated:

- `hawtio.addExtension()` always registers — regardless of the Preferences value.
- `HawtioExtensionSlot` checks `preferencesService.isExtensionsEnabled()` at render time and returns `null` when disabled.
- Toggling on/off takes effect immediately without re-bootstrapping.

```ts
// preferences/preferences-service.ts
const STORAGE_KEY_EXTENSIONS_ENABLED = 'preferences.extensionsEnabled'

isExtensionsEnabled(): boolean {
  const value = localStorage.getItem(STORAGE_KEY_EXTENSIONS_ENABLED)
  return value ? JSON.parse(value) : true // default: enabled (opt-out model)
}

saveExtensionsEnabled(value: boolean): void {
  localStorage.setItem(STORAGE_KEY_EXTENSIONS_ENABLED, JSON.stringify(value))
}
```

> **Note:** This is a per-user localStorage setting. Administrator-level lockdown would require a separate `hawtconfig.json` extension (tracked separately).

## `headerItems` / `UniversalHeaderItem` Migration

Once `HawtioExtensionSlot` is stable, `Plugin.headerItems` should be deprecated. A bootstrap-time adapter will translate existing `headerItems` entries into `extensionRegistry` registrations:

```
Current:
  Plugin.headerItems → collectHeaderItems() → ToolbarItem

After migration:
  Plugin.headerItems → [bootstrap adapter] → extensionRegistry
  <HawtioExtensionSlot id='core-header-menu' />  (in HawtioHeader.tsx)
```

The `universal: true/false` distinction will be replaced by whether the slot itself is rendered unconditionally or only when a specific route is active.

**This migration is deferred to a separate issue.**

## Slot ID Naming Convention

Format: **`<plugin>-<view>-<area>`** — kebab-case throughout.

| Segment  | Meaning                                 | Examples                             |
| -------- | --------------------------------------- | ------------------------------------ |
| `plugin` | ID of the plugin that declares the slot | `jmx`, `camel`, `core`               |
| `view`   | View, screen, or tab identifier         | `attributes`, `operations`, `header` |
| `area`   | UI area within the view                 | `toolbar`, `actions`, `footer`       |

**Examples:**

```
jmx-attributes-toolbar    // JMX plugin, Attributes view, toolbar area
jmx-operations-actions    // JMX plugin, Operations view, actions area
camel-route-toolbar        // Camel plugin, Route view, toolbar area
core-header-menu           // Core header, menu area
```

> Note: the `plugin` prefix of a slot ID identifies the **host plugin that declares the slot**,
> not the `pluginId` field of `ExtensionEntry` (which identifies the **registering plugin**).

## Key Files

```
packages/hawtio/src/
├── core/
│   ├── core.ts                            # IHawtio, HawtioCore, addExtension()
│   ├── extension-registry.ts              # ExtensionEntry, extensionRegistry (internal)
│   └── index.ts                           # re-exports ExtensionEntry type only
├── ui/
│   ├── extension/
│   │   ├── HawtioExtensionSlot.tsx        # HawtioExtensionSlot component
│   │   └── index.ts                       # re-exports HawtioExtensionSlot
│   └── page/
│       └── HawtioHeader.tsx               # future migration target for headerItems
├── preferences/
│   └── preferences-service.ts             # isExtensionsEnabled(), saveExtensionsEnabled()
└── plugins/shared/attributes/
    └── Attributes.tsx                     # first host: jmx-attributes-toolbar slot

app/src/examples/example1-deferred/
└── index.ts                               # sample: addExtension() in a deferred loader
```
