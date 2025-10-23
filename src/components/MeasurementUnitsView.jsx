import { useMemo, useState } from 'react'
import Modal from './Modal'

const createUnitId = () => {
  const { crypto } = globalThis
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `unit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const createEmptyUnit = () => ({
  id: null,
  name: '',
  symbol: '',
  description: '',
  active: true,
})

export default function MeasurementUnitsView({ units, onCreate, onUpdate, onToggle }) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(createEmptyUnit)
  const [errors, setErrors] = useState({})

  const filteredUnits = useMemo(() => {
    if (!search.trim()) return units
    const term = search.trim().toLowerCase()
    return units.filter((unit) => {
      const description = unit.description ? unit.description.toLowerCase() : ''
      return (
        unit.name.toLowerCase().includes(term) ||
        unit.symbol.toLowerCase().includes(term) ||
        description.includes(term)
      )
    })
  }, [units, search])

  const openCreateForm = () => {
    setFormData(createEmptyUnit())
    setErrors({})
    setShowForm(true)
  }

  const openEditForm = (unit) => {
    setFormData({ ...unit })
    setErrors({})
    setShowForm(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = {}

    if (!formData.name.trim()) {
      nextErrors.name = 'Bezeichnung erforderlich.'
    }
    if (!formData.symbol.trim()) {
      nextErrors.symbol = 'Symbol erforderlich.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const payload = {
      ...formData,
      id: formData.id ?? createUnitId(),
      name: formData.name.trim(),
      symbol: formData.symbol.trim(),
      description: formData.description.trim(),
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
          <h2>Messeinheiten</h2>
          <p>Verwalten Sie alle verfügbaren Einheiten für Ihre Probenarten.</p>
        </div>
        <div className="module__actions">
          <input
            type="search"
            placeholder="Suche nach Einheit"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" className="primary" onClick={openCreateForm}>
            Neue Einheit
          </button>
        </div>
      </header>

      <div className="card">
        <div className="table-meta">
          <h3>Stammdaten</h3>
          <span>{filteredUnits.length} Einträge</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Bezeichnung</th>
                <th>Symbol</th>
                <th>Beschreibung</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    Keine Einheiten gefunden.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => (
                  <tr key={unit.id}>
                    <td>{unit.name}</td>
                    <td>
                      <span className="badge badge--outlined">{unit.symbol}</span>
                    </td>
                    <td>{unit.description || '—'}</td>
                    <td>
                      <span className={`status-badge status-${unit.active ? 'aktiv' : 'inaktiv'}`}>
                        {unit.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="table-actions">
                      <button type="button" className="icon-button" onClick={() => openEditForm(unit)}>
                        ✏️
                      </button>
                      <button type="button" className="icon-button" onClick={() => onToggle(unit.id)}>
                        {unit.active ? '⏸️' : '▶️'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm ? (
        <Modal
          title={formData.id ? 'Einheit bearbeiten' : 'Neue Einheit anlegen'}
          onClose={() => setShowForm(false)}
          footer={
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setShowForm(false)}>
                Abbrechen
              </button>
              <button type="submit" form="unit-form" className="primary">
                Speichern
              </button>
            </div>
          }
        >
          <form id="unit-form" className="form" onSubmit={handleSubmit}>
            <div className="form__grid">
              <label>
                <span>Bezeichnung</span>
                <input
                  name="name"
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="z. B. Temperatur"
                />
                {errors.name ? <span className="form__error">{errors.name}</span> : null}
              </label>
              <label>
                <span>Symbol</span>
                <input
                  name="symbol"
                  value={formData.symbol}
                  onChange={(event) => setFormData((prev) => ({ ...prev, symbol: event.target.value }))}
                  placeholder="z. B. °C"
                />
                {errors.symbol ? <span className="form__error">{errors.symbol}</span> : null}
              </label>
              <label className="form__full">
                <span>Beschreibung (optional)</span>
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </label>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
