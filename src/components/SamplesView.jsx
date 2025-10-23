import { useMemo, useState } from 'react'
import Modal from './Modal'

const createEmptyForm = () => ({
  id: null,
  date: new Date().toISOString().slice(0, 10),
  programId: '',
  facilityId: '',
  sampleTypeId: '',
  value: '',
  employeeId: '',
  note: '',
})

const createId = () => {
  const { crypto } = globalThis
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `sample-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const validateSample = (data, availableSampleTypes) => {
  const errors = {}
  if (!data.date) {
    errors.date = 'Bitte Datum angeben.'
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
  if (!data.employeeId) {
    errors.employeeId = 'Mitarbeiter auswählen.'
  }
  return errors
}

const formatDate = (value) => new Date(value).toLocaleDateString('de-DE')

export default function SamplesView({
  programs,
  facilities,
  employees,
  samples,
  onCreate,
  onUpdate,
  onDelete,
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
  const [formData, setFormData] = useState(createEmptyForm)
  const [errors, setErrors] = useState({})
  const [editingSampleId, setEditingSampleId] = useState(null)

  const programMap = useMemo(() => Object.fromEntries(programs.map((p) => [p.id, p])), [programs])
  const facilityMap = useMemo(() => Object.fromEntries(facilities.map((f) => [f.id, f])), [facilities])
  const employeeMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees])

  const filteredFacilities = useMemo(() => {
    if (!formData.programId) return facilities
    return facilities.filter((facility) => facility.programId === formData.programId)
  }, [facilities, formData.programId])

  const availableSampleTypes = useMemo(() => {
    const facility = facilities.find((item) => item.id === formData.facilityId)
    return facility ? facility.sampleTypes : []
  }, [facilities, formData.facilityId])

  const selectedSampleType = availableSampleTypes.find((type) => type.id === formData.sampleTypeId)

  const activeEmployees = useMemo(() => employees.filter((employee) => employee.active), [employees])

  const filteredSamples = useMemo(() => {
    return samples.filter((sample) => {
      if (filters.programId && sample.programId !== filters.programId) {
        return false
      }
      if (filters.facilityId && sample.facilityId !== filters.facilityId) {
        return false
      }
      if (filters.sampleTypeId && sample.sampleTypeId !== filters.sampleTypeId) {
        return false
      }
      if (filters.employeeId && sample.employeeId !== filters.employeeId) {
        return false
      }
      if (filters.dateFrom && new Date(sample.date) < new Date(filters.dateFrom)) {
        return false
      }
      if (filters.dateTo && new Date(sample.date) > new Date(filters.dateTo)) {
        return false
      }
      return true
    })
  }, [samples, filters])

  const sortedSamples = useMemo(() => {
    return [...filteredSamples].sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date)
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
    setFormData(createEmptyForm())
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
      date: sample.date,
      programId: sample.programId,
      facilityId: sample.facilityId,
      sampleTypeId: sample.sampleTypeId,
      value: sample.value.toString(),
      employeeId: sample.employeeId,
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

    const payload = {
      id: formData.id ?? createId(),
      date: formData.date,
      programId: formData.programId,
      facilityId: formData.facilityId,
      sampleTypeId: formData.sampleTypeId,
      value: Number(formData.value),
      employeeId: formData.employeeId,
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
    if (window.confirm(`Probe vom ${formatDate(sample.date)} wirklich löschen?`)) {
      onDelete(sample.id)
    }
  }

  const exportCsv = () => {
    const header = [
      'Datum',
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
      const employee = employeeMap[sample.employeeId]
      const unit = sampleType?.unit ?? ''
      return [
        formatDate(sample.date),
        program?.name ?? '',
        facility?.name ?? '',
        sampleType?.name ?? '',
        String(sample.value).replace('.', ','),
        unit,
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

      <div className="card">
        <div className="table-meta">
          <h3>Erfasste Proben</h3>
          <span>{sortedSamples.length} Datensätze</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
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
                  const employee = employeeMap[sample.employeeId]
                  return (
                    <tr key={sample.id}>
                      <td>{formatDate(sample.date)}</td>
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
                          <span className="badge badge--unit">{sampleType?.unit ?? ''}</span>
                        </div>
                      </td>
                      <td>
                        <strong>{sample.value}</strong>
                        {sampleType?.unit ? <span className="value-unit"> {sampleType.unit}</span> : null}
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
                <span>Eingabedatum</span>
                <input type="date" name="date" value={formData.date} onChange={handleChange} />
                {errors.date ? <span className="form__error">{errors.date}</span> : null}
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
                <span>Messwert {selectedSampleType ? `(${selectedSampleType.unit})` : ''}</span>
                <input type="number" name="value" value={formData.value} onChange={handleChange} step="any" />
                {errors.value ? <span className="form__error">{errors.value}</span> : null}
              </label>
              <label>
                <span>Mitarbeiter</span>
                <select name="employeeId" value={formData.employeeId} onChange={handleChange}>
                  <option value="">Bitte wählen</option>
                  {activeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} – {employee.department}
                    </option>
                  ))}
                </select>
                {errors.employeeId ? <span className="form__error">{errors.employeeId}</span> : null}
              </label>
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
