import './StatsCards.css'

export default function StatsCards({ stats }) {
  const pct = stats?.total ? Math.round((stats.sinContactar / stats.total) * 100) : 0

  return (
    <div className="cards">
      <div className="card">
        <div className="num">{stats?.total ?? '—'}</div>
        <div className="label">Total leads</div>
      </div>
      <div className="card">
        <div className="num">{stats?.sinContactar ?? '—'}</div>
        <div className="label">Sin contactar</div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: pct + '%' }} />
        </div>
      </div>
      <div className="card orange">
        <div className="num">{stats?.contactado ?? '—'}</div>
        <div className="label">Contactados</div>
      </div>
      <div className="card green">
        <div className="num">{stats?.respondio ?? '—'}</div>
        <div className="label">Respondieron</div>
      </div>
      <div className="card red">
        <div className="num">{stats?.rebote ?? '—'}</div>
        <div className="label">Rebotes</div>
      </div>
    </div>
  )
}
