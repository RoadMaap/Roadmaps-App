import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const savedTheme = window.localStorage.getItem('app_theme') || 'dark';
const prefersDark = savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.classList.toggle('dark', savedTheme === 'dark' || prefersDark);

const mountApp = async () => {
  await Promise.all([
    document.fonts.load('400 16px "Vazirmatn Variable"', 'متن فارسی'),
    document.fonts.load('400 16px "Switzer"', 'Welcome back'),
  ])

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

mountApp()