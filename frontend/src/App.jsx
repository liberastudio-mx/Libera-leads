import { useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import './App.css'

const initialForm = {
  businessType: 'Restaurante familiar',
  businessName: 'Casa Naranjo',
  rating: '4.2',
  reviewCount: '38',
  hasWebsite: 'no',
  hasSocial: 'si',
  competitor: 'Brasa Norte',
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function yesNoLabel(value) {
  return value === 'si' ? 'sí' : 'no'
}

export default function App() {
  const [form, setForm] = useState(initialForm)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const cardRef = useRef(null)

  const businessName = form.businessName.trim() || 'Tu negocio'
  const businessType = form.businessType.trim() || 'negocio local'
  const competitor = form.competitor.trim() || 'un competidor directo'
  const rating = form.rating.trim() || '0.0'
  const reviewCount = form.reviewCount.trim() || '0'

  const diagnosis = useMemo(() => {
    const hasWebsite = form.hasWebsite === 'si'
    const hasSocial = form.hasSocial === 'si'
    const webGap = hasWebsite
      ? 'tiene sitio web, pero necesita convertir mejor a quien llega desde Google.'
      : 'no tiene sitio web, por eso depende demasiado de que el cliente llame o escriba desde el perfil.'
    const socialGap = hasSocial
      ? 'sus redes ayudan a dar confianza, aunque no reemplazan una presencia clara en búsqueda.'
      : 'no muestra redes activas, lo que reduce confianza cuando alguien compara opciones.'

    return {
      problem:
        `${businessName} aparece con una reputación de ${rating} estrellas y ${reviewCount} reseñas, pero su presencia digital no está trabajando como un sistema. ${webGap} Además, ${socialGap}`,
      explanation:
        `Cuando alguien busca un ${businessType.toLowerCase()}, decide en segundos. Si ve pocas señales claras, menos reseñas recientes o canales incompletos, pasa al siguiente resultado aunque el servicio sea bueno.`,
      comparison:
        `${competitor} aparece arriba y captura la atención primero. Eso no significa que sea mejor negocio; significa que hoy comunica más rápido confianza, prueba social y una ruta simple para contactar.`,
      solution:
        `LIBERA ordena la presencia local: perfil de Google, reseñas, mensajes, sitio ligero, contenido y seguimiento. El objetivo es que cada búsqueda termine con una acción medible: llamada, WhatsApp o visita.`,
      close:
        `La oportunidad inmediata es cerrar la brecha visible. Con una base clara, ${businessName} puede competir mejor en móvil y convertir más clientes sin depender de publicaciones sueltas.`,
    }
  }, [businessName, businessType, competitor, form.hasSocial, form.hasWebsite, rating, reviewCount])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function downloadPng() {
    if (!cardRef.current) return

    setIsDownloading(true)
    setDownloadError('')

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#f8f1e6',
        width: cardRef.current.scrollWidth,
        height: cardRef.current.scrollHeight,
        style: {
          transform: 'none',
          width: `${cardRef.current.scrollWidth}px`,
          height: `${cardRef.current.scrollHeight}px`,
        },
      })

      const link = document.createElement('a')
      link.download = `diagnóstico-${slugify(businessName) || 'negocio'}-libera.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error(error)
      setDownloadError('No se pudo generar el PNG. Intenta de nuevo.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <form className="diagnosis-form">
          <div className="form-heading">
            <p className="eyebrow">LIBERA leads</p>
            <h1>Generador de diagnóstico visual</h1>
            <p>
              Crea una tarjeta vertical lista para enviar por WhatsApp o móvil.
            </p>
          </div>

          <label>
            Giro del negocio
            <input name="businessType" value={form.businessType} onChange={updateField} />
          </label>

          <label>
            Nombre del negocio
            <input name="businessName" value={form.businessName} onChange={updateField} />
          </label>

          <div className="field-grid">
            <label>
              Calificación en Google
              <input name="rating" value={form.rating} onChange={updateField} inputMode="decimal" />
            </label>

            <label>
              Número de reseñas
              <input name="reviewCount" value={form.reviewCount} onChange={updateField} inputMode="numeric" />
            </label>
          </div>

          <div className="field-grid">
            <label>
              Tiene sitio web
              <select name="hasWebsite" value={form.hasWebsite} onChange={updateField}>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </label>

            <label>
              Tiene redes sociales
              <select name="hasSocial" value={form.hasSocial} onChange={updateField}>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>

          <label>
            Competidor que aparece arriba
            <input name="competitor" value={form.competitor} onChange={updateField} />
          </label>

          <button className="download-button" type="button" onClick={downloadPng} disabled={isDownloading}>
            {isDownloading ? 'Generando PNG...' : 'Descargar PNG'}
          </button>

          {downloadError && <p className="form-error">{downloadError}</p>}
        </form>

        <section className="preview-panel" aria-label="Preview del diagnóstico">
          <article className="diagnosis-card" ref={cardRef}>
            <header className="card-hero">
              <div>
                <span className="card-kicker">Diagnóstico local</span>
                <h2>{businessName}</h2>
              </div>
              <span className="libera-mark">LIBERA</span>
            </header>

            <section className="score-strip">
              <div>
                <strong>{rating}</strong>
                <span>Google</span>
              </div>
              <div>
                <strong>{reviewCount}</strong>
                <span>reseñas</span>
              </div>
              <div>
                <strong>{yesNoLabel(form.hasWebsite)}</strong>
                <span>sitio web</span>
              </div>
              <div>
                <strong>{yesNoLabel(form.hasSocial)}</strong>
                <span>redes</span>
              </div>
            </section>

            <section className="diagnosis-section problem">
              <span>⚠ PROBLEMA</span>
              <h3>Lo que frena tu negocio</h3>
              <p>{diagnosis.problem}</p>
            </section>

            <section className="diagnosis-section explanation">
              <span>📋 SITUACIÓN</span>
              <h3>Qué significa esto</h3>
              <p>{diagnosis.explanation}</p>
            </section>

            <section className="competitor-block">
              <p>Comparación directa</p>
              <h3>{competitor}</h3>
              <span>{diagnosis.comparison}</span>
            </section>

            <section className="diagnosis-section solution">
              <span>✅ SOLUCIÓN</span>
              <h3>Plan LIBERA</h3>
              <p>{diagnosis.solution}</p>
            </section>

            <footer className="card-close">
              <p>{diagnosis.close}</p>
              <strong>Sesión de diagnóstico gratuita →</strong>
            </footer>
          </article>
        </section>
      </section>
    </main>
  )
}
