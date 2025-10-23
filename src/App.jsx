import { useMemo, useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import SamplesView from './components/SamplesView'
import ProgramsView from './components/ProgramsView'
import FacilitiesView from './components/FacilitiesView'
import EmployeesView from './components/EmployeesView'
import DashboardView from './components/DashboardView'
import MeasurementUnitsView from './components/MeasurementUnitsView'
import { initialPrograms, initialFacilities, initialEmployees, initialUnits } from './data/initialData'

const MODULES = {
  dashboard: 'Auswertungen',
  samples: 'Proben',
  programs: 'Programme',
  facilities: 'Anlagen',
  employees: 'Mitarbeiter',
  units: 'Messeinheiten',
}

export default function App() {
  const [activeModule, setActiveModule] = useState('dashboard')
  const [programs, setPrograms] = useState(initialPrograms)
  const [facilities, setFacilities] = useState(initialFacilities)
  const [employees, setEmployees] = useState(initialEmployees)
  const [units, setUnits] = useState(initialUnits)
  const [samples, setSamples] = useState([])
  const [currentEmployeeId] = useState(
    initialEmployees.find((employee) => employee.active)?.id ?? initialEmployees[0]?.id ?? null
  )

  const sortedPrograms = useMemo(
    () => [...programs].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')),
    [programs]
  )

  const sortedFacilities = useMemo(
    () => [...facilities].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')),
    [facilities]
  )

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')),
    [employees]
  )

  const sortedUnits = useMemo(
    () => [...units].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')),
    [units]
  )

  const handleCreateSample = (sample) => {
    setSamples((prev) => [...prev, sample])
  }

  const handleUpdateSample = (updatedSample) => {
    setSamples((prev) => prev.map((sample) => (sample.id === updatedSample.id ? updatedSample : sample)))
  }

  const handleDeleteSample = (id) => {
    setSamples((prev) => prev.filter((sample) => sample.id !== id))
  }

  const handleCreateProgram = (program) => {
    setPrograms((prev) => [...prev, program])
  }

  const handleUpdateProgram = (updatedProgram) => {
    setPrograms((prev) => prev.map((program) => (program.id === updatedProgram.id ? updatedProgram : program)))
  }

  const handleToggleProgram = (programId) => {
    setPrograms((prev) =>
      prev.map((program) =>
        program.id === programId
          ? { ...program, status: program.status === 'aktiv' ? 'inaktiv' : 'aktiv' }
          : program
      )
    )
  }

  const handleCreateFacility = (facility) => {
    setFacilities((prev) => [...prev, facility])
  }

  const handleUpdateFacility = (updatedFacility) => {
    setFacilities((prev) => prev.map((facility) => (facility.id === updatedFacility.id ? updatedFacility : facility)))
  }

  const handleCreateEmployee = (employee) => {
    setEmployees((prev) => [...prev, employee])
  }

  const handleUpdateEmployee = (updatedEmployee) => {
    setEmployees((prev) => prev.map((employee) => (employee.id === updatedEmployee.id ? updatedEmployee : employee)))
  }

  const handleToggleEmployee = (employeeId) => {
    setEmployees((prev) =>
      prev.map((employee) =>
        employee.id === employeeId ? { ...employee, active: !employee.active } : employee
      )
    )
  }

  const handleCreateUnit = (unit) => {
    setUnits((prev) => [...prev, unit])
  }

  const handleUpdateUnit = (updatedUnit) => {
    setUnits((prev) => prev.map((unit) => (unit.id === updatedUnit.id ? updatedUnit : unit)))
  }

  const handleToggleUnit = (unitId) => {
    setUnits((prev) =>
      prev.map((unit) => (unit.id === unitId ? { ...unit, active: !unit.active } : unit))
    )
  }

  const renderModule = () => {
    switch (activeModule) {
      case 'samples':
        return (
          <SamplesView
            programs={sortedPrograms}
            facilities={sortedFacilities}
            employees={sortedEmployees}
            units={sortedUnits}
            samples={samples}
            onCreate={handleCreateSample}
            onUpdate={handleUpdateSample}
            onDelete={handleDeleteSample}
            currentEmployeeId={currentEmployeeId}
          />
        )
      case 'programs':
        return (
          <ProgramsView
            programs={sortedPrograms}
            onCreate={handleCreateProgram}
            onUpdate={handleUpdateProgram}
            onToggle={handleToggleProgram}
          />
        )
      case 'facilities':
        return (
          <FacilitiesView
            facilities={sortedFacilities}
            programs={sortedPrograms}
            units={sortedUnits}
            onCreate={handleCreateFacility}
            onUpdate={handleUpdateFacility}
          />
        )
      case 'employees':
        return (
          <EmployeesView
            employees={sortedEmployees}
            onCreate={handleCreateEmployee}
            onUpdate={handleUpdateEmployee}
            onToggle={handleToggleEmployee}
          />
        )
      case 'units':
        return (
          <MeasurementUnitsView
            units={sortedUnits}
            onCreate={handleCreateUnit}
            onUpdate={handleUpdateUnit}
            onToggle={handleToggleUnit}
          />
        )
      default:
        return (
          <DashboardView
            programs={sortedPrograms}
            facilities={sortedFacilities}
            employees={sortedEmployees}
            units={sortedUnits}
            samples={samples}
          />
        )
    }
  }

  return (
    <div className="app-shell">
      <Sidebar activeModule={activeModule} onSelect={setActiveModule} />
      <main className="app-content" aria-live="polite">
        <div className="app-content__header">
          <h1>{MODULES[activeModule]}</h1>
          <p>Labor Management System – digitale Steuerzentrale für Proben, Anlagen und Teams.</p>
        </div>
        {renderModule()}
      </main>
    </div>
  )
}
