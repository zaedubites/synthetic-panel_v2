import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Import design system styles
import '@eduBITES/edubites-design-system/dist/index.css'

// Import local styles
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
