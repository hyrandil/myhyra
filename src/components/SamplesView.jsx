import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Modal from './Modal'

const toDateKey = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (input) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const toLocalDateTimeInput = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (input) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

const formatDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

const createEmptyForm = (employeeId) => ({
  id: null,
  capturedAt: toLocalDateTimeInput(new Date()),
  programId: '',
  facilityId: '',
  sampleTypeId: '',
  value: '',
  employeeId: employeeId ?? '',
  note: '',
})

const createSampleId = () => {
  const { crypto } = globalThis
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `sample-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const createDraftId = () => {
  const { crypto } = globalThis
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `draft-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const validateSample = (data, availableSampleTypes) => {
  const errors = {}
  if (!data.capturedAt) {
    errors.capturedAt = 'Bitte Datum und Uhrzeit angeben.'
  }
  if (!data.programId) {
    errors.programId = 'Programm auswählen.'
  }
  if (!data.facilityId) {
    errors.facilityId = 'Anlage auswählen.'
  }
  if (!data.sampleTypeId) {
    errors.sampleTypeId = 'Probenart auswählen.'
  } else if (!availableSampleTypes.some((type) => type.id === data.sampleTypeId)) {
    errors.sampleTypeId = 'Ungültige Probenart.'
  }
  if (data.value === '') {
    errors.value = 'Messwert eingeben.'
  } else if (Number.isNaN(Number(data.value))) {
    errors.value = 'Messwert muss eine Zahl sein.'
  }
  return errors
}

export default function SamplesView({
  programs,
  facilities,
  employees,
  units,
  samples,
  onCreate,
  onUpdate,
  onDelete,
  currentEmployeeId,
}) {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    programId: '',
    facilityId: '',
    sampleTypeId: '',
    employeeId: '',
  })
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(() => createEmptyForm(currentEmployeeId))
  const [errors, setErrors] = useState({})
  const [editingSampleId, setEditingSampleId] = useState(null)
  const [drafts, setDrafts] = useState([])

  const programMap = useMemo(() => Object.fromEntries(programs.map((p) => [p.id, p])), [programs])
  const facilityMap = useMemo(() => Object.fromEntries(facilities.map((f) => [f.id, f])), [facilities])
  const employeeMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees])
  const unitsMap = useMemo(() => Object.fromEntries(units.map((unit) => [unit.id, unit])), [units])

  const filteredFacilities = useMemo(() => {
    if (!formData.programId) return facilities
    return facilities.filter((facility) => facility.programId === formData.programId)
  }, [facilities, formData.programId])

  const availableSampleTypes = useMemo(() => {
    const facility = facilities.find((item) => item.id === formData.facilityId)
    return facility ? facility.sampleTypes : []
  }, [facilities, formData.facilityId])

  const selectedSampleType = availableSampleTypes.find((type) => type.id === formData.sampleTypeId)
  const selectedUnit = selectedSampleType ? unitsMap[selectedSampleType.unitId] : null
  const currentEmployee = currentEmployeeId ? employeeMap[currentEmployeeId] : null

  const filteredSamples = useMemo(() => {
    return samples.filter((sample) => {
      if (filters.programId && sample.programId !== filters.programId) return false
      if (filters.facilityId && sample.facilityId !== filters.facilityId) return false
      if (filters.sampleTypeId && sample.sampleTypeId !== filters.sampleTypeId) return false
      if (filters.employeeId && sample.employeeId !== filters.employeeId) return false
      const sampleDateKey = sample.date ?? (sample.capturedAt ? toDateKey(sample.capturedAt) : '')
      if (filters.dateFrom && sampleDateKey < filters.dateFrom) return false
      if (filters.dateTo && sampleDateKey > filters.dateTo) return false
      return true
    })
  }, [samples, filters])

  const sortedSamples = useMemo(() => {
    return [...filteredSamples].sort((a, b) => {
      const dateDiff = new Date(b.capturedAt ?? b.date) - new Date(a.capturedAt ?? a.date)
      if (dateDiff !== 0) return dateDiff
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  }, [filteredSamples])

  const availableSampleFilters = useMemo(() => {
    if (!filters.facilityId) {
      return facilities.flatMap((facility) =>
        facility.sampleTypes.map((type) => ({ ...type, facilityId: facility.id }))
      )
    }
    const facility = facilities.find((item) => item.id === filters.facilityId)
    return facility ? facility.sampleTypes.map((type) => ({ ...type, facilityId: facility.id })) : []
  }, [facilities, filters.facilityId])

  const resetForm = () => {
    setFormData(createEmptyForm(currentEmployeeId))
    setErrors({})
    setEditingSampleId(null)
  }

  const openCreateForm = () => {
    resetForm()
    setShowForm(true)
  }

  const openEditForm = (sample) => {
    setFormData({
      id: sample.id,
      capturedAt: toLocalDateTimeInput(sample.capturedAt ?? sample.date),
      programId: sample.programId,
      facilityId: sample.facilityId,
      sampleTypeId: sample.sampleTypeId,
      value: sample.value.toString(),
      employeeId: sample.employeeId ?? currentEmployeeId,
      note: sample.note || '',
    })
    setEditingSampleId(sample.id)
    setErrors({})
    setShowForm(true)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    const updatedForm = {
      ...formData,
      [name]: value,
      ...(name === 'programId' ? { facilityId: '', sampleTypeId: '' } : {}),
      ...(name === 'facilityId' ? { sampleTypeId: '' } : {}),
    }
    setFormData(updatedForm)
    const currentFacility = facilities.find((item) => item.id === updatedForm.facilityId)
    const currentSampleTypes = currentFacility ? currentFacility.sampleTypes : []
    setErrors(validateSample(updatedForm, currentSampleTypes))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const formFacility = facilities.find((item) => item.id === formData.facilityId)
    const currentSampleTypes = formFacility ? formFacility.sampleTypes : []
    const validationResult = validateSample(formData, currentSampleTypes)
    setErrors(validationResult)
    if (Object.keys(validationResult).length > 0) {
      return
    }

    const capturedAtIso = new Date(formData.capturedAt).toISOString()
    const payload = {
      id: formData.id ?? createSampleId(),
      capturedAt: capturedAtIso,
      date: toDateKey(formData.capturedAt),
      programId: formData.programId,
      facilityId: formData.facilityId,
      sampleTypeId: formData.sampleTypeId,
      value: Number(formData.value),
      employeeId: formData.employeeId || currentEmployeeId,
      note: formData.note?.trim() || '',
      createdAt: formData.id
        ? samples.find((sample) => sample.id === formData.id)?.createdAt
        : new Date().toISOString(),
    }

    if (editingSampleId) {
      onUpdate(payload)
    } else {
      onCreate(payload)
    }

    setShowForm(false)
    resetForm()
  }

  const handleDelete = (sample) => {
    const timestamp = sample.capturedAt ?? sample.date
    if (window.confirm(`Probe vom ${formatDateTime(timestamp)} wirklich löschen?`)) {
      onDelete(sample.id)
    }
  }

  const handleStoreDraft = () => {
    const draftPayload = {
      draftId: createDraftId(),
      formData: { ...formData, employeeId: currentEmployeeId || formData.employeeId },
      editingSampleId,
      savedAt: new Date().toISOString(),
    }

    setDrafts((prev) => {
      if (editingSampleId) {
        const existingIndex = prev.findIndex((draft) => draft.editingSampleId === editingSampleId)
        if (existingIndex !== -1) {
          const next = [...prev]
          next[existingIndex] = { ...draftPayload, draftId: prev[existingIndex].draftId }
          return next
        }
      }
      return [...prev, draftPayload]
    })

    setShowForm(false)
    setErrors({})
    resetForm()
  }

  const resumeDraft = (draftId) => {
    const draft = drafts.find((item) => item.draftId === draftId)
    if (!draft) return
    setDrafts((prev) => prev.filter((item) => item.draftId !== draftId))
    setFormData(draft.formData)
    setEditingSampleId(draft.editingSampleId)
    setErrors({})
    setShowForm(true)
  }

  const removeDraft = (draftId) => {
    setDrafts((prev) => prev.filter((item) => item.draftId !== draftId))
  }

  const exportCsv = () => {
    const header = [
      'Datum & Uhrzeit',
      'Programm',
      'Anlage',
      'Probenart',
      'Messwert',
      'Einheit',
      'Mitarbeiter',
      'Notiz',
    ]

    const rows = sortedSamples.map((sample) => {
      const program = programMap[sample.programId]
      const facility = facilityMap[sample.facilityId]
      const sampleType = facility?.sampleTypes.find((type) => type.id === sample.sampleTypeId)
      const unitSymbol = sampleType ? unitsMap[sampleType.unitId]?.symbol ?? '' : ''
      const employee = employeeMap[sample.employeeId]
      return [
        formatDateTime(sample.capturedAt ?? sample.date),
        program?.name ?? '',
        facility?.name ?? '',
        sampleType?.name ?? '',
        String(sample.value).replace('.', ','),
        unitSymbol,
        employee ? `${employee.name}` : '',
        sample.note ?? '',
      ]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(';')
    })

    const csvContent = [header.join(';'), ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `proben_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="module">
      <header className="module__header">
        <div>
          <h2>Probenverwaltung</h2>
          <p>Erfassen, filtern und exportieren Sie alle Laborproben.</p>
        </div>
        <div className="module__actions">
          <button type="button" className="primary" onClick={openCreateForm}>
            Neue Probe
          </button>
          <button type="button" className="ghost" onClick={exportCsv} disabled={sortedSamples.length === 0}>
            CSV Export
          </button>
        </div>
      </header>

      <div className="card filters">
        <h3>Filter</h3>
        <div className="filters__grid">
          <label>
            <span>Von</span>
            <input
              type="date"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
            />
          </label>
          <label>
            <span>Bis</span>
            <input
              type="date"
              name="dateTo"
              value={filters.dateTo}
              onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
            />
          </label>
          <label>
            <span>Programm</span>
            <select
              value={filters.programId}
              onChange={(event) =>
                setFilters({ ...filters, programId: event.target.value, facilityId: '', sampleTypeId: '' })
              }
            >
              <option value="">Alle</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Anlage</span>
            <select
              value={filters.facilityId}
              onChange={(event) =>
                setFilters({ ...filters, facilityId: event.target.value, sampleTypeId: '' })
              }
            >
              <option value="">Alle</option>
              {facilities
                .filter((facility) => !filters.programId || facility.programId === filters.programId)
                .map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Probenart</span>
            <select
              value={filters.sampleTypeId}
              onChange={(event) => setFilters({ ...filters, sampleTypeId: event.target.value })}
            >
              <option value="">Alle</option>
              {availableSampleFilters.map((type) => (
                <option key={`${type.facilityId}-${type.id}`} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Mitarbeiter</span>
            <select
              value={filters.employeeId}
              onChange={(event) => setFilters({ ...filters, employeeId: event.target.value })}
            >
              <option value="">Alle</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {drafts.length > 0 ? (
        <div className="card drafts">
          <div className="table-meta">
            <h3>Aktive Messungen</h3>
            <span>{drafts.length} Entwürfe</span>
          </div>
          <ul className="draft-list">
            {drafts.map((draft) => {
              const draftProgram = programMap[draft.formData.programId]
              const draftFacility = facilityMap[draft.formData.facilityId]
              const draftSampleType = draftFacility?.sampleTypes.find(
                (type) => type.id === draft.formData.sampleTypeId
              )
              const draftUnit = draftSampleType
                ? unitsMap[draftSampleType.unitId]?.symbol ?? ''
                : ''
              return (
                <li key={draft.draftId} className="draft-list__item">
                  <div className="draft-list__meta">
                    <strong>{draftSampleType?.name ?? 'Unvollständig'}</strong>
                    <div className="draft-list__details">
                      {draftProgram ? <span>{draftProgram.name}</span> : null}
                      {draftFacility ? <span>{draftFacility.name}</span> : null}
                      {draftUnit ? <span>{draftUnit}</span> : null}
                    </div>
                    <small>Gespeichert: {formatDateTime(draft.savedAt)}</small>
                  </div>
                  <div className="draft-list__actions">
                    <button type="button" className="ghost" onClick={() => resumeDraft(draft.draftId)}>
                      Fortsetzen
                    </button>
                    <button type="button" className="icon-button" onClick={() => removeDraft(draft.draftId)}>
                      🗑️
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="card">
        <div className="table-meta">
          <h3>Erfasste Proben</h3>
          <span>{sortedSamples.length} Datensätze</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Datum & Uhrzeit</th>
                <th>Programm</th>
                <th>Anlage</th>
                <th>Probenart</th>
                <th>Messwert</th>
                <th>Mitarbeiter</th>
                <th>Notiz</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedSamples.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    Noch keine passenden Proben.
                  </td>
                </tr>
              ) : (
                sortedSamples.map((sample) => {
                  const program = programMap[sample.programId]
                  const facility = facilityMap[sample.facilityId]
                  const sampleType = facility?.sampleTypes.find((type) => type.id === sample.sampleTypeId)
                  const sampleUnit = sampleType ? unitsMap[sampleType.unitId]?.symbol ?? '' : ''
                  const employee = employeeMap[sample.employeeId]
                  return (
                    <tr key={sample.id}>
                      <td>{formatDateTime(sample.capturedAt ?? sample.date)}</td>
                      <td>
                        <span
                          className="badge badge--program"
                          style={{ '--badge-color': program?.color ?? '#0f172a' }}
                        >
                          {program?.name ?? 'Unbekannt'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge--facility status-${facility?.status?.toLowerCase()}`}>
                          {facility?.name ?? 'Unbekannt'}
                        </span>
                      </td>
                      <td>
                        <div className="badge-group">
                          <span className="badge badge--outlined">{sampleType?.name ?? 'Gelöscht'}</span>
                          <span className="badge badge--unit">{sampleUnit}</span>
                        </div>
                      </td>
                      <td>
                        <strong>{sample.value}</strong>
                        {sampleUnit ? <span className="value-unit"> {sampleUnit}</span> : null}
                      </td>
                      <td>{employee?.name ?? 'Unbekannt'}</td>
                      <td>{sample.note || '—'}</td>
                      <td className="table-actions">
                        <button type="button" className="icon-button" onClick={() => openEditForm(sample)}>
                          ✏️
                        </button>
                        <button type="button" className="icon-button" onClick={() => handleDelete(sample)}>
                          🗑️
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm ? (
        <Modal
          title={editingSampleId ? 'Probe bearbeiten' : 'Neue Probe erfassen'}
          onClose={() => {
            setShowForm(false)
            resetForm()
          }}
          footer={
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={handleStoreDraft}>
                Minimieren
              </button>
              <button type="button" className="ghost" onClick={() => setShowForm(false)}>
                Abbrechen
              </button>
              <button type="submit" form="sample-form" className="primary">
                {editingSampleId ? 'Änderungen speichern' : 'Probe speichern'}
              </button>
            </div>
          }
        >
          <form id="sample-form" className="form" onSubmit={handleSubmit}>
            <div className="form__grid">
              <label>
                <span>Eingabezeitpunkt</span>
                <input
                  type="datetime-local"
                  name="capturedAt"
                  value={formData.capturedAt}
                  onChange={handleChange}
                />
                {errors.capturedAt ? <span className="form__error">{errors.capturedAt}</span> : null}
              </label>
              <label>
                <span>Programm</span>
                <select name="programId" value={formData.programId} onChange={handleChange}>
                  <option value="">Bitte wählen</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id} disabled={program.status !== 'aktiv'}>
                      {program.name} {program.status !== 'aktiv' ? '(inaktiv)' : ''}
                    </option>
                  ))}
                </select>
                {errors.programId ? <span className="form__error">{errors.programId}</span> : null}
              </label>
              <label>
                <span>Anlage</span>
                <select name="facilityId" value={formData.facilityId} onChange={handleChange}>
                  <option value="">Bitte wählen</option>
                  {filteredFacilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name} – {facility.status}
                    </option>
                  ))}
                </select>
                {errors.facilityId ? <span className="form__error">{errors.facilityId}</span> : null}
              </label>
              <label>
                <span>Probenart</span>
                <select name="sampleTypeId" value={formData.sampleTypeId} onChange={handleChange}>
                  <option value="">Bitte wählen</option>
                  {availableSampleTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {errors.sampleTypeId ? <span className="form__error">{errors.sampleTypeId}</span> : null}
              </label>
              <label>
                <span>Messwert {selectedUnit ? `(${selectedUnit.symbol})` : ''}</span>
                <input type="number" name="value" value={formData.value} onChange={handleChange} step="any" />
                {errors.value ? <span className="form__error">{errors.value}</span> : null}
              </label>
              <div className="form__info">
                <span>Erfasst durch</span>
                <strong>{currentEmployee ? currentEmployee.name : 'Unbekannt'}</strong>
              </div>
              <label className="form__full">
                <span>Notiz (optional)</span>
                <textarea name="note" rows={3} value={formData.note} onChange={handleChange} placeholder="Zusätzliche Beobachtungen"></textarea>
              </label>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}

const programShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  description: PropTypes.string,
  status: PropTypes.string,
  color: PropTypes.string,
})

const facilitySampleTypeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  unitId: PropTypes.string.isRequired,
})

const facilityShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  location: PropTypes.string,
  manager: PropTypes.string,
  status: PropTypes.string,
  programId: PropTypes.string.isRequired,
  sampleTypes: PropTypes.arrayOf(facilitySampleTypeShape).isRequired,
})

const employeeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  position: PropTypes.string,
  department: PropTypes.string,
  email: PropTypes.string,
  phone: PropTypes.string,
  active: PropTypes.bool.isRequired,
})

const unitShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  symbol: PropTypes.string.isRequired,
  description: PropTypes.string,
  active: PropTypes.bool.isRequired,
})

const sampleShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  capturedAt: PropTypes.string,
  date: PropTypes.string,
  programId: PropTypes.string.isRequired,
  facilityId: PropTypes.string.isRequired,
  sampleTypeId: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  employeeId: PropTypes.string,
  note: PropTypes.string,
  createdAt: PropTypes.string,
})

SamplesView.propTypes = {
  programs: PropTypes.arrayOf(programShape).isRequired,
  facilities: PropTypes.arrayOf(facilityShape).isRequired,
  employees: PropTypes.arrayOf(employeeShape).isRequired,
  units: PropTypes.arrayOf(unitShape).isRequired,
  samples: PropTypes.arrayOf(sampleShape).isRequired,
  onCreate: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  currentEmployeeId: PropTypes.string,
}

SamplesView.defaultProps = {
  currentEmployeeId: '',
}
