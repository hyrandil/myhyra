import { useMemo, useState } from 'react'
import Modal from './Modal'

const emptyEmployee = {
  id: null,
  name: '',
  position: '',
  department: '',
  email: '',
  phone: '',
  active: true,
}

const createId = () => {
  const { crypto } = globalThis
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `employee-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export default function EmployeesView({ employees, onCreate, onUpdate, onToggle }) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(emptyEmployee)
  const [errors, setErrors] = useState({})
  const [search, setSearch] = useState('')

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return employees
    return employees.filter((employee) =>
      [employee.name, employee.position, employee.department]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query))
    )
  }, [employees, search])

  const activeCount = useMemo(() => employees.filter((employee) => employee.active).length, [employees])

  const openCreateForm = () => {
    setFormData(emptyEmployee)
    setErrors({})
    setShowForm(true)
  }

  const openEditForm = (employee) => {
    setFormData({ ...employee })
    setErrors({})
    setShowForm(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!formData.name.trim()) {
      nextErrors.name = 'Name angeben.'
    }
    if (!formData.position.trim()) {
      nextErrors.position = 'Position angeben.'
    }
    if (!formData.department.trim()) {
      nextErrors.department = 'Abteilung angeben.'
    }
    if (!formData.email.trim()) {
      nextErrors.email = 'E-Mail hinzufügen.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const payload = {
      ...formData,
      id: formData.id ?? createId(),
      name: formData.name.trim(),
      position: formData.position.trim(),
      department: formData.department.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
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
          <h2>Mitarbeiter</h2>
          <p>Pflegen Sie den Labor-Mitarbeiterstamm.</p>
        </div>
        <div className="module__actions">
          <input
            type="search"
            placeholder="Suchen..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" className="primary" onClick={openCreateForm}>
            Neuer Mitarbeiter
          </button>
        </div>
      </header>

      <div className="card">
        <div className="table-meta">
          <h3>Übersicht</h3>
          <span>{activeCount} aktive Mitarbeiter</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Position</th>
                <th>Abteilung</th>
                <th>Kontakt</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{employee.position}</td>
                  <td>{employee.department}</td>
                  <td>
                    <div className="contact">
                      <a href={`mailto:${employee.email}`}>{employee.email}</a>
                      <span>{employee.phone}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-${employee.active ? 'aktiv' : 'inaktiv'}`}>
                      {employee.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button type="button" className="icon-button" onClick={() => openEditForm(employee)}>
                      ✏️
                    </button>
                    <button type="button" className="icon-button" onClick={() => onToggle(employee.id)}>
                      {employee.active ? '⏸️' : '▶️'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Keine Mitarbeiter gefunden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showForm ? (
        <Modal
          title={formData.id ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
          onClose={() => setShowForm(false)}
          footer={
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setShowForm(false)}>
                Abbrechen
              </button>
              <button type="submit" form="employee-form" className="primary">
                Speichern
              </button>
            </div>
          }
        >
          <form id="employee-form" className="form" onSubmit={handleSubmit}>
            <div className="form__grid">
              <label>
                <span>Name</span>
                <input
                  name="name"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Max Mustermann"
                />
                {errors.name ? <span className="form__error">{errors.name}</span> : null}
              </label>
              <label>
                <span>Position</span>
                <input
                  name="position"
                  value={formData.position}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, position: event.target.value }))
                  }
                  placeholder="z. B. Labortechniker"
                />
                {errors.position ? <span className="form__error">{errors.position}</span> : null}
              </label>
              <label>
                <span>Abteilung</span>
                <input
                  name="department"
                  value={formData.department}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, department: event.target.value }))
                  }
                  placeholder="z. B. Synthese"
                />
                {errors.department ? <span className="form__error">{errors.department}</span> : null}
              </label>
              <label>
                <span>E-Mail</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="name@labor.de"
                />
                {errors.email ? <span className="form__error">{errors.email}</span> : null}
              </label>
              <label>
                <span>Telefon</span>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="z. B. +49 ..."
                />
              </label>
              <label>
                <span>Status</span>
                <select
                  name="active"
                  value={formData.active ? 'true' : 'false'}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, active: event.target.value === 'true' }))
                  }
                >
                  <option value="true">Aktiv</option>
                  <option value="false">Inaktiv</option>
                </select>
              </label>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
