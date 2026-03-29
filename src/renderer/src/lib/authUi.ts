import type { LocaleCode } from '@shared/types'
import { t } from '../i18n'

export function authErrorMessage(locale: LocaleCode, code?: string): string {
  switch (code) {
    case 'USERNAME_SHORT':
      return t(locale, 'auth.error.usernameShort')
    case 'PASSWORD_SHORT':
      return t(locale, 'auth.error.passwordShort')
    case 'EXISTS':
      return t(locale, 'auth.error.exists')
    case 'BAD_CREDENTIALS':
    case 'NO_ACCOUNT':
      return t(locale, 'auth.error.credentials')
    default:
      return t(locale, 'auth.error.generic')
  }
}
