import { useState } from 'react'
import './LogsPanel.css'

function colorize(content) {
  return content
    .replace(/✓[^\n]*/g, m => `<span class="ok">${m}</span>`)
    .replace(/✗[^\n]*/g, m => `<span class="err">${m}</span>`)
    .replace(/═══[^\n]*/g, m => `<span class="info">${m}</span>`)
    .replace(/──[^\n]*/g, m => `<span class="dim">${m}</span>`)
}

export default function LogsPanel({ logs }) {
  const [active, setActive] = useState(0)

  if (!logs.length) {
    return <div className="logs"><div className="empty">Sin logs todavía</div></div>
  }

  return (
    <div className="logs">
      <div className="log-tabs">
        {logs.map((l, i) => (
          <button
            key={l.date}
            className={`log-tab${active === i ? ' active' : ''}`}
            onClick={() => setActive(i)}
          >
            {l.date}
          </button>
        ))}
      </div>
      <div
        className="log-content"
        dangerouslySetInnerHTML={{ __html: colorize(logs[active]?.content ?? '') }}
      />
    </div>
  )
}
