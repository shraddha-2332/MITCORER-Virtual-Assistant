import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'))
function render(Page) {
  root.render(<StrictMode><Page /></StrictMode>)
}

if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('ui') === 'shadcn-applicant') {
  import('./ApplicantWorkspacePilot.jsx').then(({ ApplicantWorkspacePilot }) => render(ApplicantWorkspacePilot))
} else {
  render(App)
}
