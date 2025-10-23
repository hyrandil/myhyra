import { useMemo, useState } from 'react'

const formatDate = (date) => new Date(date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })

const daysBetween = (a, b) => {
  const diff = new Date(a).setHours(0, 0, 0, 0) - new Date(b).setHours(0, 0, 0, 0)
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

const buildTimeseries = (samples) => {
  const today = new Date()
  return Array.from({ length: 14 })
    .map((_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (13 - index))
      const key = date.toISOString().slice(0, 10)
      const count = samples.filter((sample) => sample.date === key).length
      return { date: key, count }
    })
}

export default function DashboardView({ programs, facilities, employees, units, samples }) {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    programId: '',
    facilityId: '',
    employeeId: '',
  })

  const facilityMap = useMemo(() => Object.fromEntries(facilities.map((facility) => [facility.id, facility])), [facilities])
  const unitsMap = useMemo(() => Object.fromEntries(units.map((unit) => [unit.id, unit])), [units])
  const getSampleDateKey = (sample) =>
    sample.date ?? (sample.capturedAt ? new Date(sample.capturedAt).toISOString().slice(0, 10) : '')

  const filteredSamples = useMemo(() => {
    return samples.filter((sample) => {
      if (filters.programId && sample.programId !== filters.programId) return false
      if (filters.facilityId && sample.facilityId !== filters.facilityId) return false
      if (filters.employeeId && sample.employeeId !== filters.employeeId) return false
      const sampleDateKey = getSampleDateKey(sample)
      if (filters.dateFrom && sampleDateKey < filters.dateFrom) return false
      if (filters.dateTo && sampleDateKey > filters.dateTo) return false
      return true
    })
  }, [samples, filters])

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayCount = filteredSamples.filter((sample) => getSampleDateKey(sample) === todayKey).length
  const last7Count = filteredSamples.filter((sample) => {
    const difference = daysBetween(todayKey, getSampleDateKey(sample))
    return difference >= 0 && difference <= 6
  }).length
  const totalCount = filteredSamples.length

  const programStats = useMemo(() => {
    const totals = new Map()
    filteredSamples.forEach((sample) => {
      totals.set(sample.programId, (totals.get(sample.programId) ?? 0) + 1)
    })
    return programs.map((program) => {
      const count = totals.get(program.id) ?? 0
      const percentage = totalCount === 0 ? 0 : Math.round((count / totalCount) * 100)
      return { id: program.id, label: program.name, count, percentage, color: program.color }
    })
  }, [filteredSamples, programs, totalCount])

  const facilityStats = useMemo(() => {
    const totals = new Map()
    filteredSamples.forEach((sample) => {
      totals.set(sample.facilityId, (totals.get(sample.facilityId) ?? 0) + 1)
    })
    return facilities.map((facility) => {
      const count = totals.get(facility.id) ?? 0
      return { id: facility.id, label: facility.name, count, status: facility.status }
    })
  }, [filteredSamples, facilities])

  const employeeStats = useMemo(() => {
    const totals = new Map()
    filteredSamples.forEach((sample) => {
      totals.set(sample.employeeId, (totals.get(sample.employeeId) ?? 0) + 1)
    })
    return employees.map((employee) => ({
      id: employee.id,
      label: employee.name,
      count: totals.get(employee.id) ?? 0,
      active: employee.active,
    }))
  }, [filteredSamples, employees])

  const sampleTypeStats = useMemo(() => {
    const aggregates = new Map()
    filteredSamples.forEach((sample) => {
      const facility = facilityMap[sample.facilityId]
      const sampleType = facility?.sampleTypes.find((type) => type.id === sample.sampleTypeId)
      const key = sampleType ? `${sampleType.name}|||${sampleType.unitId}` : 'Unbekannt|||'
      const current = aggregates.get(key) ?? { sum: 0, count: 0 }
      aggregates.set(key, { sum: current.sum + sample.value, count: current.count + 1 })
    })
    return Array.from(aggregates.entries()).map(([key, value]) => {
      const [name, unitId] = key.split('|||')
      const unitSymbol = unitsMap[unitId]?.symbol ?? ''
      return {
        name,
        unit: unitSymbol,
        average: value.count === 0 ? 0 : value.sum / value.count,
        count: value.count,
      }
    })
  }, [filteredSamples, facilityMap, unitsMap])

  const timeseries = useMemo(
    () => buildTimeseries(filteredSamples.map((sample) => ({ ...sample, date: getSampleDateKey(sample) }))),
    [filteredSamples]
  )
  const maxTimeseries = Math.max(...timeseries.map((item) => item.count), 1)

  const resetFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', programId: '', facilityId: '', employeeId: '' })
  }

  return (
    <section className="module">
      <header className="module__header">
        <div>
          <h2>Auswertungen</h2>
          <p>Alle Kennzahlen Ihres Labors auf einen Blick.</p>
        </div>
        <div className="module__actions">
          <button type="button" className="ghost" onClick={resetFilters}>
            Filter zurücksetzen
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
              value={filters.dateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            />
          </label>
          <label>
            <span>Bis</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            />
          </label>
          <label>
            <span>Programm</span>
            <select
              value={filters.programId}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  programId: event.target.value,
                  facilityId: '',
                }))
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
              onChange={(event) => setFilters((prev) => ({ ...prev, facilityId: event.target.value }))}
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
            <span>Mitarbeiter</span>
            <select
              value={filters.employeeId}
              onChange={(event) => setFilters((prev) => ({ ...prev, employeeId: event.target.value }))}
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

      <div className="stat-grid">
        <div className="stat-card">
          <h3>Heutige Proben</h3>
          <p className="stat-card__value">{todayCount}</p>
          <span className="stat-card__hint">{samples.length} Gesamtproben im System</span>
        </div>
        <div className="stat-card">
          <h3>Letzte 7 Tage</h3>
          <p className="stat-card__value">{last7Count}</p>
          <span className="stat-card__hint">inkl. aktiver Filter</span>
        </div>
        <div className="stat-card">
          <h3>Gesamtanzahl</h3>
          <p className="stat-card__value">{totalCount}</p>
          <span className="stat-card__hint">Basis: Filterergebnis</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <h3>Verteilung nach Programmen</h3>
          <ul className="distribution-list">
            {programStats.map((item) => (
              <li key={item.id}>
                <div>
                  <span className="distribution-list__label">{item.label}</span>
                  <span className="distribution-list__value">{item.count}</span>
                </div>
                <div className="progress">
                  <div
                    className="progress__bar"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.percentage}
                  />
                  <span className="progress__label">{item.percentage}%</span>
                </div>
              </li>
            ))}
            {programStats.every((item) => item.count === 0) ? (
              <li className="distribution-list__empty">Keine Proben für die aktuellen Filter.</li>
            ) : null}
          </ul>
        </section>

        <section className="card">
          <h3>Top-Anlagen</h3>
          <ul className="distribution-list">
            {facilityStats.map((item) => (
              <li key={item.id}>
                <div>
                  <span className="distribution-list__label">{item.label}</span>
                  <span className="distribution-list__value">{item.count}</span>
                </div>
                <span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status}</span>
              </li>
            ))}
            {facilityStats.every((item) => item.count === 0) ? (
              <li className="distribution-list__empty">Noch keine Anlagen mit Probenaktivität.</li>
            ) : null}
          </ul>
        </section>

        <section className="card">
          <h3>Mitarbeiteraktivität</h3>
          <ul className="distribution-list">
            {employeeStats.map((item) => (
              <li key={item.id}>
                <div>
                  <span className="distribution-list__label">{item.label}</span>
                  <span className="distribution-list__value">{item.count}</span>
                </div>
                <span className={`status-badge status-${item.active ? 'aktiv' : 'inaktiv'}`}>
                  {item.active ? 'Aktiv' : 'Inaktiv'}
                </span>
              </li>
            ))}
            {employeeStats.every((item) => item.count === 0) ? (
              <li className="distribution-list__empty">Noch keine erfassten Proben.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <h3>Zeitverlauf (14 Tage)</h3>
          <div className="timeseries">
            {timeseries.map((item) => (
              <div key={item.date} className="timeseries__item">
                <div
                  className="timeseries__bar"
                  style={{ height: `${(item.count / maxTimeseries) * 100}%` }}
                  aria-label={`${item.count} Proben am ${formatDate(item.date)}`}
                />
                <span>{formatDate(item.date)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>Durchschnittswerte nach Probenart</h3>
          <table className="compact-table">
            <thead>
              <tr>
                <th>Probenart</th>
                <th>Ø-Wert</th>
                <th>Anzahl</th>
              </tr>
            </thead>
            <tbody>
              {sampleTypeStats.length === 0 ? (
                <tr>
                  <td colSpan={3} className="table-empty">
                    Keine Daten vorhanden.
                  </td>
                </tr>
              ) : (
                sampleTypeStats.map((item) => (
                  <tr key={item.name + item.unit}>
                    <td>
                      {item.name}
                      {item.unit ? <span className="value-unit"> ({item.unit})</span> : null}
                    </td>
                    <td>{item.average.toFixed(2)}</td>
                    <td>{item.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  )
}
