import PropTypes from 'prop-types'

const MODULES = [
  { id: 'dashboard', label: 'Auswertungen', icon: '📊' },
  { id: 'samples', label: 'Proben', icon: '🔬' },
  { id: 'programs', label: 'Programme', icon: '🧪' },
  { id: 'facilities', label: 'Anlagen', icon: '🏭' },
  { id: 'units', label: 'Messeinheiten', icon: '⚖️' },
  { id: 'employees', label: 'Mitarbeiter', icon: '👥' },
]

export default function Sidebar({ activeModule, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__branding">
        <span className="sidebar__logo" aria-hidden="true">
          🧬
        </span>
        <div>
          <h1>Hyra Labs</h1>
          <p>Labor Management</p>
        </div>
      </div>
      <nav className="sidebar__nav" aria-label="Hauptnavigation">
        {MODULES.map((module) => (
          <button
            key={module.id}
            type="button"
            className={`sidebar__item ${activeModule === module.id ? 'is-active' : ''}`}
            onClick={() => onSelect(module.id)}
          >
            <span className="sidebar__icon" aria-hidden="true">
              {module.icon}
            </span>
            <span>{module.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar__footer">
        <p className="sidebar__version">Version 1.0</p>
        <p className="sidebar__hint">Session-Daten werden nicht gespeichert.</p>
      </div>
    </aside>
  )
}

Sidebar.propTypes = {
  activeModule: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
}
