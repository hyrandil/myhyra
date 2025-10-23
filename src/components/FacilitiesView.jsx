import { useMemo, useState } from 'react'
import Modal from './Modal'

const statusOptions = ['Aktiv', 'Wartung', 'Stillstand']

const createFacilityId = () => {
  const { crypto } = globalThis
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `facility-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const createSampleTypeId = () => {
  const { crypto } = globalThis
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `stype-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const createEmptyFacility = (defaultUnitId = '') => ({
  id: null,
  name: '',
  programId: '',
  location: '',
  manager: '',
  status: 'Aktiv',
  sampleTypes: [
    { id: createSampleTypeId(), name: '', unitId: defaultUnitId },
  ],
})

export default function FacilitiesView({ facilities, programs, units, onCreate, onUpdate }) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(createEmptyFacility)
  const [errors, setErrors] = useState({})
  const [filterProgram, setFilterProgram] = useState('')

  const filteredFacilities = useMemo(() => {
    if (!filterProgram) return facilities
    return facilities.filter((facility) => facility.programId === filterProgram)
  }, [facilities, filterProgram])

  const programMap = useMemo(() => Object.fromEntries(programs.map((program) => [program.id, program])), [programs])
  const unitsMap = useMemo(() => Object.fromEntries(units.map((unit) => [unit.id, unit])), [units])
  const defaultUnitId = useMemo(
    () => units.find((unit) => unit.active)?.id ?? units[0]?.id ?? '',
    [units]
  )

  const openCreateForm = () => {
    setFormData(createEmptyFacility(defaultUnitId))
    setErrors({})
    setShowForm(true)
  }

  const openEditForm = (facility) => {
    setFormData({
      ...facility,
      sampleTypes: facility.sampleTypes.map((type) => ({ ...type })),
    })
    setErrors({})
    setShowForm(true)
  }

  const updateSampleType = (id, payload) => {
    setFormData((prev) => ({
      ...prev,
      sampleTypes: prev.sampleTypes.map((type) => (type.id === id ? { ...type, ...payload } : type)),
    }))
  }

  const addSampleType = () => {
    setFormData((prev) => ({
      ...prev,
      sampleTypes: [
        ...prev.sampleTypes,
        { id: createSampleTypeId(), name: '', unitId: defaultUnitId },
      ],
    }))
  }

  const removeSampleType = (id) => {
    setFormData((prev) => ({
      ...prev,
      sampleTypes: prev.sampleTypes.length > 1 ? prev.sampleTypes.filter((type) => type.id !== id) : prev.sampleTypes,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!formData.name.trim()) {
      nextErrors.name = 'Name erforderlich.'
    }
    if (!formData.programId) {
      nextErrors.programId = 'Programm wählen.'
    }
    if (!formData.location.trim()) {
      nextErrors.location = 'Standort angeben.'
    }
    if (!formData.manager.trim()) {
      nextErrors.manager = 'Verantwortlichen eintragen.'
    }

    const cleanedSampleTypes = formData.sampleTypes.map((type) => ({
      ...type,
      name: type.name.trim(),
      unitId: type.unitId,
    }))

    if (cleanedSampleTypes.some((type) => !type.name || !type.unitId)) {
      nextErrors.sampleTypes = 'Alle Probenarten benötigen Namen und Einheit.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const payload = {
      ...formData,
      id: formData.id ?? createFacilityId(),
      name: formData.name.trim(),
      location: formData.location.trim(),
      manager: formData.manager.trim(),
      sampleTypes: cleanedSampleTypes,
    }

    if (formData.id) {
      onUpdate(payload)
    } else {
      onCreate(payload)
    }

    setShowForm(false)
  }

  return (
    <section className="module">
      <header className="module__header">
        <div>
          <h2>Anlagenübersicht</h2>
          <p>Alle Produktionsanlagen mit Status und Probenarten.</p>
        </div>
        <div className="module__actions">
          <select value={filterProgram} onChange={(event) => setFilterProgram(event.target.value)}>
            <option value="">Alle Programme</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          <button type="button" className="primary" onClick={openCreateForm}>
            Neue Anlage
          </button>
        </div>
      </header>

      <div className="facility-grid">
        {filteredFacilities.map((facility) => (
          <article key={facility.id} className="facility-card">
            <header>
              <div>
                <h3>{facility.name}</h3>
                <p className="facility-card__program">{programMap[facility.programId]?.name ?? 'Unbekannt'}</p>
              </div>
              <span className={`status-badge status-${facility.status.toLowerCase()}`}>
                {facility.status}
              </span>
            </header>
            <dl className="facility-card__meta">
              <div>
                <dt>Standort</dt>
                <dd>{facility.location}</dd>
              </div>
              <div>
                <dt>Verantwortlich</dt>
                <dd>{facility.manager}</dd>
              </div>
            </dl>
            <section>
              <h4>Probenarten</h4>
              <ul className="chip-list">
                {facility.sampleTypes.map((type) => (
                  <li key={type.id} className="chip">
                    <span className="chip__label">{type.name}</span>
                    <span className="chip__unit">{unitsMap[type.unitId]?.symbol ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </section>
            <footer>
              <button type="button" className="ghost" onClick={() => openEditForm(facility)}>
                Bearbeiten
              </button>
            </footer>
          </article>
        ))}
        {filteredFacilities.length === 0 ? (
          <div className="facility-empty">Keine Anlagen für den gewählten Filter.</div>
        ) : null}
      </div>

      {showForm ? (
        <Modal
          title={formData.id ? 'Anlage bearbeiten' : 'Neue Anlage'}
          onClose={() => setShowForm(false)}
          footer={
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setShowForm(false)}>
                Abbrechen
              </button>
              <button type="submit" form="facility-form" className="primary">
                Speichern
              </button>
            </div>
          }
        >
          <form id="facility-form" className="form" onSubmit={handleSubmit}>
            <div className="form__grid">
              <label>
                <span>Name</span>
                <input
                  name="name"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="z. B. Fermenter 12"
                />
                {errors.name ? <span className="form__error">{errors.name}</span> : null}
              </label>
              <label>
                <span>Programm</span>
                <select
                  name="programId"
                  value={formData.programId}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, programId: event.target.value }))
                  }
                >
                  <option value="">Bitte wählen</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
                {errors.programId ? <span className="form__error">{errors.programId}</span> : null}
              </label>
              <label>
                <span>Standort</span>
                <input
                  name="location"
                  value={formData.location}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, location: event.target.value }))
                  }
                  placeholder="Gebäude / Bereich"
                />
                {errors.location ? <span className="form__error">{errors.location}</span> : null}
              </label>
              <label>
                <span>Verantwortlicher</span>
                <input
                  name="manager"
                  value={formData.manager}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, manager: event.target.value }))
                  }
                  placeholder="Name"
                />
                {errors.manager ? <span className="form__error">{errors.manager}</span> : null}
              </label>
              <label>
                <span>Status</span>
                <select
                  name="status"
                  value={formData.status}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="form__fieldset">
              <legend>Probenarten</legend>
              {errors.sampleTypes ? <span className="form__error">{errors.sampleTypes}</span> : null}
              {formData.sampleTypes.map((type) => (
                <div key={type.id} className="form__grid form__grid--compact">
                  <label>
                    <span>Name</span>
                    <input
                      value={type.name}
                      onChange={(event) => updateSampleType(type.id, { name: event.target.value })}
                      placeholder="z. B. Glucose"
                    />
                  </label>
                  <label>
                    <span>Einheit</span>
                    <select
                      value={type.unitId}
                      onChange={(event) => updateSampleType(type.id, { unitId: event.target.value })}
                    >
                      <option value="">Bitte wählen</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id} disabled={!unit.active && unit.id !== type.unitId}>
                          {unit.symbol} – {unit.name}
                          {!unit.active ? ' (inaktiv)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form__actions">
                    <button type="button" className="icon-button" onClick={() => removeSampleType(type.id)}>
                      ➖
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="ghost" onClick={addSampleType}>
                Probenart hinzufügen
              </button>
            </fieldset>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
