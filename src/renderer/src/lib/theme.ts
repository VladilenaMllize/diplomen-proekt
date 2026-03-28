import { useSyncExternalStore } from 'react'

export const THEME_PREF_KEY = 'app-theme-preference'

function subscribeHtmlClass(callback: () => void) {
  const obs = new MutationObserver(callback)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => obs.disconnect()
}

function getIsDarkClass() {
  return document.documentElement.classList.contains('dark')
}

export function useIsDarkClass() {
  return useSyncExternalStore(subscribeHtmlClass, getIsDarkClass, () => false)
}
