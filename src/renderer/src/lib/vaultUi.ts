import type { AppSettings } from '@shared/types'
import { t } from '../i18n'

export function vaultErrorMessage(locale: AppSettings['locale'], code?: string): string {
  switch (code) {
    case 'BAD_PASSWORD':
      return t(locale, 'vault.badPassword')
    case 'PASSWORD_SHORT':
      return t(locale, 'vault.passwordShort')
    case 'CORRUPT':
    case 'UNLOCK_FAILED':
    case 'ENABLE_FAILED':
    case 'DISABLE_FAILED':
    case 'CHANGE_FAILED':
      return t(locale, 'vault.opError')
    default:
      return t(locale, 'vault.error')
  }
}
