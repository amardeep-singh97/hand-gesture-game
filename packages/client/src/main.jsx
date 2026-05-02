import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { appQueryClient } from './tanstack-query.js'
import { QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { clientAppRoutes } from './routes/index.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <QueryClientProvider client={appQueryClient}>
        <RouterProvider router={new createBrowserRouter(clientAppRoutes)}/>
      </QueryClientProvider>
  </StrictMode>,
)
