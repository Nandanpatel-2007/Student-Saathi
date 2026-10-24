import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/** React.lazy for a module that exports its page as a named export. */
export function lazyNamed<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
): LazyExoticComponent<ComponentType> {
  return lazy(async () => ({ default: (await load())[name] }))
}
