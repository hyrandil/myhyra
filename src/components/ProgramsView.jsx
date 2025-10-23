import { useMemo, useState } from 'react'
import Modal from './Modal'

const emptyProgram = {
  id: null,
  name: '',
  description: '',
  status: 'aktiv',
  color: '#1d4ed8',
}

const createId = () => {
  const { crypto } = globalThis
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `program-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export default function ProgramsView({ programs, onCreate, onUpdate, onToggle }) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(emptyProgram)
  const [errors, setErrors] = useState({})

  const activeCount = useMemo(() => programs.filter((program) => program.status === 'aktiv').length, [programs])

  const resetForm = () => {
    setFormData(emptyProgram)
    setErrors({})
  }

  const handleEdit = (program) => {
    setFormData({ ...program })
    setErrors({})
    setShowForm(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!formData.name.trim()) {
      nextErrors.name = 'Name ist erforderlich.'
    }
    if (!formData.description.trim()) {
      nextErrors.description = 'Beschreibung angeben.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const payload = {
      ...formData,
      id: formData.id ?? createId(),
      name: formData.name.trim(),
      description: formData.description.trim(),
    }

    if (formData.id) {
      onUpdate(payload)
    } else {
      onCreate(payload)
    }

    setShowForm(false)
    resetForm()
  }

  return (
    <section className="module">
      <header className="module__header">
        <div>
          <h2>Programme</h2>
          <p>Strukturieren Sie Anlagen und Proben über Programme.</p>
        </div>
        <div className="module__actions">
          <button type="button" className="primary" onClick={() => setShowForm(true)}>
            Neues Programm
          </button>
        </div>
      </header>

      <div className="card">
        <div className="table-meta">
          <h3>Übersicht</h3>
          <span>{activeCount} aktive Programme</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Beschreibung</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => (
                <tr key={program.id}>
                  <td>
                    <div className="badge-group">
                      <span
                        className="badge badge--program"
                        style={{ '--badge-color': program.color }}
                      >
                        {program.name}
                      </span>
                    </div>
                  </td>
                  <td>{program.description}</td>
                  <td>
                    <span className={`status-badge status-${program.status}`}>
                      {program.status === 'aktiv' ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button type="button" className="icon-button" onClick={() => handleEdit(program)}>
                      ✏️
                    </button>
                    <button type="button" className="icon-button" onClick={() => onToggle(program.id)}>
                      {program.status === 'aktiv' ? '⏸️' : '▶️'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm ? (
        <Modal
          title={formData.id ? 'Programm bearbeiten' : 'Neues Programm'}
          onClose={() => {
            setShowForm(false)
            resetForm()
          }}
          footer={
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setShowForm(false)}>
                Abbrechen
              </button>
              <button type="submit" form="program-form" className="primary">
                Speichern
              </button>
            </div>
          }
        >
          <form id="program-form" className="form" onSubmit={handleSubmit}>
            <div className="form__grid">
              <label>
                <span>Name</span>
                <input
                  name="name"
                  value={formData.name}
                  onChange={(event) => {
                    const value = event.target.value
                    setFormData((prev) => ({ ...prev, name: value }))
                    setErrors((prev) => ({ ...prev, name: value.trim() ? undefined : 'Name ist erforderlich.' }))
                  }}
                  placeholder="z. B. Destillation"
                />
                {errors.name ? <span className="form__error">{errors.name}</span> : null}
              </label>
              <label>
                <span>Beschreibung</span>
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={(event) => {
                    const value = event.target.value
                    setFormData((prev) => ({ ...prev, description: value }))
                    setErrors((prev) => ({ ...prev, description: value.trim() ? undefined : 'Beschreibung angeben.' }))
                  }}
                  placeholder="Kurze Erläuterung"
                />
                {errors.description ? <span className="form__error">{errors.description}</span> : null}
              </label>
              <label>
                <span>Status</span>
                <select
                  name="status"
                  value={formData.status}
                  onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="aktiv">Aktiv</option>
                  <option value="inaktiv">Inaktiv</option>
                </select>
              </label>
              <label>
                <span>Badge-Farbe</span>
                <input
                  type="color"
                  name="color"
                  value={formData.color}
                  onChange={(event) => setFormData((prev) => ({ ...prev, color: event.target.value }))}
                />
              </label>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
