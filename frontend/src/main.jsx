import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// این خط به صورت اجباری و دائمی تم دارک را روی کل پروژه فعال می‌کند
document.documentElement.classList.add('dark');

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