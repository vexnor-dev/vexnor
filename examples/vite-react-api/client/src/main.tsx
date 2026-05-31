import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes/router.js';
import { AuthProvider } from './auth-context.js';

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <AuthProvider>
         <RouterProvider router={router} />
      </AuthProvider>
   </StrictMode>,
);
