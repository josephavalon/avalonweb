// Avalon Vitality v2
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { setProvider } from '@/lib/analytics'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

if (import.meta.env.DEV) {
  setProvider((event) => {
    // eslint-disable-next-line no-console
    console.debug('[avalon:analytics]', event.name, event.props);
  });
}
