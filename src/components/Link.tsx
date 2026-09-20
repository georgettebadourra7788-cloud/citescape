import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navigate } from '../store/routeStore'

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
}

/**
 * A real <a href> (so middle-click, ctrl/cmd-click, and "open in new tab"
 * still work) that intercepts a plain left click to navigate client-side
 * via routeStore instead of a full page reload.
 */
export function Link({ to, onClick, ...rest }: LinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    navigate(to)
  }

  return <a href={to} onClick={handleClick} {...rest} />
}
