import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // data stays "fresh" for 5 mins
      cacheTime: 10 * 60 * 1000,     // keep in cache for 10 mins
      refetchOnWindowFocus: false,    // don't re-fetch when tab regains focus
      retry: 1,                       // only retry failed requests once
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)