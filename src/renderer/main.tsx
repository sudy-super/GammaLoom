import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ControlApp } from './control/ControlApp'
import { ProjectionApp } from './projection/ProjectionApp'
import './styles/global.css'

const getRoute = () => {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return hash === 'projection' ? 'projection' : 'control'
}

const Router = () => {
  const [route, setRoute] = useState<string>(getRoute)

  useEffect(() => {
    const handler = () => setRoute(getRoute())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  if (route === 'projection') {
    return <ProjectionApp />
  }

  return <ControlApp />
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element not found')
}

createRoot(container).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
