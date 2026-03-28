import { useEffect, useState } from 'react'
import type { AppSettings, Device, HttpMethod, Macro, MacroFolder, MacroInput, MacroRunResult } from '@shared/types'
import { t } from '../i18n'
import {
  formToMacroInput,
  httpMethods,
  macroToForm,
  type MacroFormState,
  type MacroStepForm
} from '../lib/macroForm'

type Props = {
  locale: AppSettings['locale']
  devices: Device[]
  folders: MacroFolder[]
  macro: Macro | null
  macros: Macro[]
  runResult: MacroRunResult | null
  error: string | null
  onSelect: (id: string | null) => void
  onSave: (input: MacroInput) => void
  onRemove: (id: string) => void
  onRun: (id: string) => void
  onCreateFolder: (name: string) => void
  onUpdateFolder: (id: string, name: string) => void
  onRemoveFolder: (id: string) => void
}

export function MacroPanel({
  locale,
  devices,
  folders,
  macro,
  macros,
  runResult,
  error,
  onSelect,
  onSave,
  onRemove,
  onRun,
  onCreateFolder,
  onUpdateFolder,
  onRemoveFolder
}: Props) {
  const [form, setForm] = useState<MacroFormState>(() => macroToForm(macro, devices[0]?.id ?? ''))
  const [formError, setFormError] = useState<string | null>(null)
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [renamingMacroId, setRenamingMacroId] = useState<string | null>(null)
  const [renameMacroDraft, setRenameMacroDraft] = useState('')

  useEffect(() => {
    setForm(macroToForm(macro, devices[0]?.id ?? ''))
  }, [macro?.id, devices])

  const handleCreateFolder = () => {
    const name = newFolderName.trim()
    if (name) {
      onCreateFolder(name)
      setNewFolderName('')
      setShowFolderForm(false)
    }
  }

  const uncategorized = macros.filter((m) => !m.folderId)
  const macrosByFolder = folders.map((f) => ({ folder: f, macros: macros.filter((m) => m.folderId === f.id) }))

  const updateForm = (patch: Partial<MacroFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const updateStep = (stepId: string, patch: Partial<MacroStepForm>) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step))
    }))
  }

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: crypto.randomUUID(),
          name: `Стъпка ${prev.steps.length + 1}`,
          method: 'GET',
          path: '',
          headersText: '{}',
          body: '',
          delayMs: ''
        }
      ]
    }))
  }

  const removeStep = (stepId: string) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((step) => step.id !== stepId)
    }))
  }

  const moveStep = (fromIndex: number, toIndex: number) => {
    setForm((prev) => {
      const steps = [...prev.steps]
      if (fromIndex < 0 || fromIndex >= steps.length || toIndex < 0 || toIndex >= steps.length) {
        return prev
      }
      const [removed] = steps.splice(fromIndex, 1)
      steps.splice(toIndex, 0, removed)
      return { ...prev, steps }
    })
  }

  const commitMacroRename = (macroId: string) => {
    const m = macros.find((x) => x.id === macroId)
    const name = renameMacroDraft.trim()
    if (!m || !name) {
      setRenamingMacroId(null)
      return
    }
    onSave({
      id: m.id,
      name,
      deviceId: m.deviceId,
      folderId: m.folderId,
      steps: m.steps
    })
    setRenamingMacroId(null)
  }

  const handleSave = () => {
    try {
      const { input } = formToMacroInput(form)
      if (!input) {
        setFormError('Невалиден макрос')
        return
      }
      setFormError(null)
      onSave(input)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Грешка при запис')
    }
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-6">
      <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(locale, 'macros.title')}</h2>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => onSelect(null)}
            >
              {t(locale, 'macros.new')}
            </button>
            <button
              type="button"
              className="rounded border border-emerald-500 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
              onClick={() => setShowFolderForm((v) => !v)}
            >
              {t(locale, 'macros.makeFolder')}
            </button>
          </div>
        </div>
        {showFolderForm && (
          <div className="mt-3 flex gap-2 rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-800/80">
            <input
              className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Име на папка"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') setShowFolderForm(false)
              }}
            />
            <button
              className="shrink-0 rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
              onClick={handleCreateFolder}
            >
              Създай
            </button>
            <button
              className="shrink-0 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              onClick={() => setShowFolderForm(false)}
            >
              Отказ
            </button>
          </div>
        )}
        <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto">
          {macros.length === 0 && (
            <div className="text-xs text-slate-500 dark:text-slate-400">{t(locale, 'macros.empty')}</div>
          )}
          {uncategorized.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Без папка</div>
              <div className="space-y-2">
                {uncategorized.map((item) => (
                  <div key={item.id} className="flex gap-1">
                    {renamingMacroId === item.id ? (
                      <div className="flex min-w-0 flex-1 gap-1">
                        <input
                          className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 text-[11px] dark:border-slate-600 dark:bg-slate-800"
                          value={renameMacroDraft}
                          onChange={(e) => setRenameMacroDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitMacroRename(item.id)
                            if (e.key === 'Escape') setRenamingMacroId(null)
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white"
                          onClick={() => commitMacroRename(item.id)}
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`min-w-0 flex-1 rounded border px-2 py-2 text-left text-xs ${
                            item.id === macro?.id
                              ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'
                          }`}
                          onClick={() => onSelect(item.id)}
                        >
                          <div className="font-medium">{item.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {t(locale, 'macros.steps')}: {item.steps.length}
                          </div>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                          title={t(locale, 'macros.rename')}
                          onClick={() => {
                            setRenamingMacroId(item.id)
                            setRenameMacroDraft(item.name)
                          }}
                        >
                          ✎
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {macrosByFolder.map(({ folder, macros: folderMacros }) => (
            <div key={folder.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                {editingFolderId === folder.id ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <input
                      className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editingFolderName.trim()) {
                            onUpdateFolder(folder.id, editingFolderName.trim())
                            setEditingFolderId(null)
                          }
                        }
                        if (e.key === 'Escape') setEditingFolderId(null)
                      }}
                      autoFocus
                    />
                    <button
                      className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white hover:bg-emerald-600"
                      onClick={() => {
                        if (editingFolderName.trim()) {
                          onUpdateFolder(folder.id, editingFolderName.trim())
                          setEditingFolderId(null)
                        }
                      }}
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {folder.name}
                    </span>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        className="rounded px-1 text-[10px] text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        onClick={() => {
                          setEditingFolderId(folder.id)
                          setEditingFolderName(folder.name)
                        }}
                        title="Преименувай"
                      >
                        ✎
                      </button>
                      <button
                        className="rounded px-1 text-[10px] text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        onClick={() => onRemoveFolder(folder.id)}
                        title="Изтрий папка"
                      >
                        ✕
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                {folderMacros.map((item) => (
                  <div key={item.id} className="flex gap-1">
                    {renamingMacroId === item.id ? (
                      <div className="flex min-w-0 flex-1 gap-1">
                        <input
                          className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 text-[11px] dark:border-slate-600 dark:bg-slate-800"
                          value={renameMacroDraft}
                          onChange={(e) => setRenameMacroDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitMacroRename(item.id)
                            if (e.key === 'Escape') setRenamingMacroId(null)
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white"
                          onClick={() => commitMacroRename(item.id)}
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`min-w-0 flex-1 rounded border px-2 py-2 text-left text-xs ${
                            item.id === macro?.id
                              ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'
                          }`}
                          onClick={() => onSelect(item.id)}
                        >
                          <div className="font-medium">{item.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {t(locale, 'macros.steps')}: {item.steps.length}
                          </div>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                          title={t(locale, 'macros.rename')}
                          onClick={() => {
                            setRenamingMacroId(item.id)
                            setRenameMacroDraft(item.name)
                          }}
                        >
                          ✎
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="shrink-0 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Конфигурация</h2>
          {macro && (
            <button
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => onRemove(macro.id)}
            >
              Изтрий
            </button>
          )}
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto text-xs">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder="Име на макрос"
            />
            <select
              className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={form.deviceId}
              onChange={(event) => updateForm({ deviceId: event.target.value })}
            >
              <option value="">Избери устройство</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              className="col-span-2 rounded border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={form.folderId}
              onChange={(event) => updateForm({ folderId: event.target.value })}
            >
              <option value="">Без папка</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">&#123;&#123;token&#125;&#125;</code>,{' '}
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">&#123;&#123;baseUrl&#125;&#125;</code> — от
            глобалните променливи;{' '}
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">&#123;&#123;step1&#125;&#125;</code>,{' '}
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">&#123;&#123;step2.field&#125;&#125;</code> — от
            предишни стъпки
          </div>
          <div className="space-y-3">
            {form.steps.map((step, index) => (
              <div
                key={step.id}
                className="rounded border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900/50"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', String(index))
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = Number.parseInt(e.dataTransfer.getData('text/plain'), 10)
                  if (!Number.isFinite(from)) return
                  moveStep(from, index)
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="cursor-grab select-none text-[11px] text-slate-400 active:cursor-grabbing dark:text-slate-500"
                    title="Drag to reorder"
                  >
                    ⋮⋮
                  </span>
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={step.name}
                    onChange={(event) => updateStep(step.id, { name: event.target.value })}
                    placeholder={`Стъпка ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="ml-2 shrink-0 text-xs text-rose-500"
                    onClick={() => removeStep(step.id)}
                  >
                    X
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-[90px_1fr] gap-2">
                  <select
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={step.method}
                    onChange={(event) => updateStep(step.id, { method: event.target.value as HttpMethod })}
                  >
                    {httpMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={step.path}
                    onChange={(event) => updateStep(step.id, { path: event.target.value })}
                    placeholder="/configure или {{step1.id}}"
                    title="Променливи: {{step1}}, {{step2.field}}"
                  />
                </div>
                <textarea
                  className="mt-2 min-h-[60px] w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={step.headersText}
                  onChange={(event) => updateStep(step.id, { headersText: event.target.value })}
                  placeholder='{"Authorization": "Bearer {{step1.token}}"}'
                  title="Стойностите могат да използват {{step1.field}}"
                />
                <textarea
                  className="mt-2 min-h-[80px] w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={step.body}
                  onChange={(event) => updateStep(step.id, { body: event.target.value })}
                  placeholder='{"id": "{{step1.id}}" или празно'
                  title="Променливи: {{step1}}, {{step2.field}}"
                />
                <input
                  className="mt-2 w-full rounded border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={step.delayMs}
                  onChange={(event) => updateStep(step.id, { delayMs: event.target.value })}
                  placeholder="Delay (ms)"
                />
              </div>
            ))}
          </div>

          <button
            className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={addStep}
          >
            Добави стъпка
          </button>

          {formError && <div className="text-xs text-rose-600 dark:text-rose-400">{formError}</div>}

          <div className="flex items-center gap-2">
            <button
              className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
              onClick={handleSave}
            >
              Запази
            </button>
            {macro && (
              <button
                className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => onRun(macro.id)}
              >
                Изпълни
              </button>
            )}
          </div>

          {error && <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>}

          {runResult && (
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-600 dark:bg-slate-800/80">
              <div className="font-semibold text-slate-600 dark:text-slate-300">
                Резултат ({runResult.results.length} стъпки, {runResult.finishedAt - runResult.startedAt} ms)
              </div>
              <div className="mt-2 space-y-3">
                {runResult.results.map((result, idx) => {
                  const isErr = !!result.error || (result.response?.status ?? 0) >= 400
                  return (
                    <div
                      key={result.stepId}
                      className={`rounded border p-3 ${
                        isErr
                          ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
                          : 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {result.stepName || `Стъпка ${idx + 1}`}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            isErr
                              ? 'bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {result.response != null
                            ? `${result.response.status} ${result.response.statusText}`
                            : 'ERR'}
                        </span>
                      </div>
                      {result.response?.durationMs != null && (
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          Време: {result.response.durationMs} ms
                        </div>
                      )}
                      {result.error && (
                        <div className="mt-2 rounded border border-rose-200 bg-white p-2 text-[11px] text-rose-700 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-300">
                          <strong>Грешка:</strong> {result.error}
                        </div>
                      )}
                      {result.response?.error && (
                        <div className="mt-2 rounded border border-rose-200 bg-white p-2 text-[11px] text-rose-700 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-300">
                          <strong>Съобщение:</strong> {result.response.error}
                        </div>
                      )}
                      {result.response?.body && result.response.body.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                            Body ({result.response.body.length} символа)
                          </summary>
                          <pre className="mt-1 max-h-32 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
                            {result.response.body.length > 500
                              ? result.response.body.slice(0, 500) + '...'
                              : result.response.body}
                          </pre>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
