import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PandaProvider } from 'panda-wallet-provider'
import { FoxRacing } from './page/FoxRacing'
import { RoutePreview } from './page/RoutePreview'
import './styles.css'

if (import.meta.env.VITE_PIXELRACING_DEBUG !== 'true') {
  console.log = () => {}
  console.debug = () => {}
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <PandaProvider>
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/route" element={<RoutePreview />} />
        <Route path="/pixelfoxracing" element={<FoxRacing />} />
        <Route path="*" element={<Navigate to="/pixelfoxracing" replace />} />
      </Routes>
    </BrowserRouter>
  </PandaProvider>,
)
