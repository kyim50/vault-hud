import React from 'react'
import { createRoot } from 'react-dom/client'
import NotchApp from './NotchApp'

document.body.classList.add('notch')
createRoot(document.getElementById('root')!).render(<NotchApp />)
