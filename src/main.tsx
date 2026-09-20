import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { brand } from './brand.ts'

// index.html's <title> is just a pre-JS placeholder — this is the one
// place the real title/description get set, both from brand.ts, so a
// rename never needs a second edit.
document.title = brand.name
let descriptionMeta = document.querySelector('meta[name="description"]')
if (!descriptionMeta) {
  descriptionMeta = document.createElement('meta')
  descriptionMeta.setAttribute('name', 'description')
  document.head.appendChild(descriptionMeta)
}
descriptionMeta.setAttribute('content', brand.shortDescription)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
