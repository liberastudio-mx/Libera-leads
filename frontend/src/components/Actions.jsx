import { useState } from 'react'
import './Actions.css'

export default function Actions({ onRefresh, onRoutineDone }) {
  const [msg, setMsg] = useState('')

  async function runRoutine() {
    await fetch('/api/run', { method: 'POST' })
    setMsg('✓ Rutina iniciada — revisa los logs en unos minutos')
    setTimeout(() => {
      setMsg('')
      onRoutineDone?.()
    }, 5000)
  }

  return (
    <div className="actions">
      <button onClick={runRoutine}>▶ Correr rutina ahora</button>
      <button className="secondary" onClick={onRefresh}>↻ Actualizar stats</button>
      {msg && <span className="run-status">{msg}</span>}
    </div>
  )
}
