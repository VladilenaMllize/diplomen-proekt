import type { HttpMethod, Macro, MacroInput } from '@shared/types'

export type MacroStepForm = {
  id: string
  name: string
  method: HttpMethod
  path: string
  headersText: string
  body: string
  delayMs: string
}

export type MacroFormState = {
  id?: string
  name: string
  deviceId: string
  folderId: string
  steps: MacroStepForm[]
}

export const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export function createEmptyMacroForm(deviceId = '', folderId = ''): MacroFormState {
  return {
    name: '',
    deviceId,
    folderId,
    steps: [
      {
        id: crypto.randomUUID(),
        name: 'Стъпка 1',
        method: 'GET',
        path: '',
        headersText: '{}',
        body: '',
        delayMs: ''
      }
    ]
  }
}

export function macroToForm(macro?: Macro | null, deviceId = ''): MacroFormState {
  if (!macro) {
    return createEmptyMacroForm(deviceId, '')
  }

  return {
    id: macro.id,
    name: macro.name,
    deviceId: macro.deviceId,
    folderId: macro.folderId ?? '',
    steps: macro.steps.map((step, index) => ({
      id: step.id,
      name: step.name || `Стъпка ${index + 1}`,
      method: step.method,
      path: step.path,
      headersText: step.headers ? JSON.stringify(step.headers, null, 2) : '{}',
      body: step.body ?? '',
      delayMs: step.delayMs ? String(step.delayMs) : ''
    }))
  }
}

export function formToMacroInput(form: MacroFormState): { input?: MacroInput; error?: string } {
  const steps = form.steps.map((step) => {
    let headers: Record<string, string> | undefined

    if (step.headersText.trim()) {
      try {
        const parsed = JSON.parse(step.headersText)
        if (parsed && typeof parsed === 'object') {
          headers = parsed
        } else {
          throw new Error('Headers should be JSON object')
        }
      } catch {
        throw new Error(`Невалидни headers при "${step.name || step.id}"`)
      }
    }

    const delayValue = Number(step.delayMs)

    return {
      id: step.id || crypto.randomUUID(),
      name: step.name,
      method: step.method,
      path: step.path,
      headers,
      body: step.body || undefined,
      delayMs: Number.isFinite(delayValue) && delayValue > 0 ? delayValue : undefined
    }
  })

  return {
    input: {
      id: form.id,
      name: form.name || 'Macro',
      deviceId: form.deviceId,
      folderId: form.folderId || undefined,
      steps
    }
  }
}
