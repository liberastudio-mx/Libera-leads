import { useState, useRef } from 'react'
import './ScraperForm.css'

export default function ScraperForm({ onDone }) {
  const [query, setQuery]   = useState('')
  const [max, setMax]       = useState(30)
  const [running, setRunning] = useState(false)
  const [lines, setLines]   = useState([])
  const [status, setStatus] = useState('')
  const logRef = useRef(null)
  const sseRef = useRef(null)

  function classForLine(text) {
    if (text.includes('✓')) return 'ok'
    if (text.includes('✗') || text.includes('Error')) return 'err'
    if (text.includes('═') || text.includes('►')) return 'info'
    return ''
  }

  function runScraper() {
    if (!query.trim()) { alert('Escribe una búsqueda'); return }
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null }

    setLines([])
    setRunning(true)
    setStatus('Iniciando scraper...')

    const url = `/api/scraper?q=${encodeURIComponent(query.trim())}&max=${max}`
    const sse = new EventSource(url)
    sseRef.current = sse

    sse.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === 'start') {
        setStatus(`Buscando "${d.query}" — máx ${d.max} resultados`)
      } else if (d.type === 'log') {
        setLines(prev => [...prev, { text: d.line, cls: classForLine(d.line) }])
        setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, 0)
      } else if (d.type === 'err') {
        setLines(prev => [...prev, { text: d.line, cls: 'err' }])
        setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, 0)
      } else if (d.type === 'done') {
        setStatus(d.code === 0 ? '✓ Scraper terminado correctamente' : `⚠ Terminó con código ${d.code}`)
        setRunning(false)
        sse.close()
        sseRef.current = null
        onDone?.()
      }
    }

    sse.onerror = () => {
      setStatus('Error de conexión con el servidor')
      setRunning(false)
    }
  }

  return (
    <div className="scraper-form">
      <div className="scraper-row">
        <div className="field">
          <label>Búsqueda</label>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !running && runScraper()}
            placeholder="dentistas Cancún Quintana Roo"
          />
        </div>
        <div className="field field-sm">
          <label>Resultados</label>
          <input
            type="number"
            value={max}
            onChange={e => setMax(parseInt(e.target.value, 10) || 30)}
            min="5"
            max="200"
          />
        </div>
        <button onClick={runScraper} disabled={running}>
          {running ? '⏳ Corriendo...' : '▶ Correr scraper'}
        </button>
      </div>

      {(lines.length > 0 || status) && (
        <div className="scraper-output">
          <div className="scraper-log" ref={logRef}>
            {lines.map((l, i) => (
              <div key={i} className={l.cls}>{l.text}</div>
            ))}
          </div>
          {status && <div className="scraper-status">{status}</div>}
        </div>
      )}
    </div>
  )
}
