/**
 * Toast notification system using react-hot-toast
 * Provides a unified notification experience across the app
 */
import { Toaster } from 'react-hot-toast'

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1f2937',
          color: '#fff',
          borderRadius: '12px',
          padding: '12px 16px',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
          style: {
            background: '#065f46',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
          style: {
            background: '#7f1d1d',
          },
          duration: 5000,
        },
      }}
    />
  )
}

export default ToastProvider
