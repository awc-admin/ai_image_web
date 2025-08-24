import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { setupMockAuth } from './utils/mockAuth';

// Setup mock authentication for local development
// This wraps the fetch API to add authentication headers
setupMockAuth();

// Check if mock auth status exists in localStorage, default to not authenticated
if (!localStorage.getItem('mockAuthStatus')) {
  localStorage.setItem('mockAuthStatus', 'unauthenticated');
}

// Setup mock response for /.auth/me and auth endpoints
const originalFetch = window.fetch;
window.fetch = async (url, options) => {
  // Handle auth endpoints
  if (url === '/.auth/login/aad') {
    localStorage.setItem('mockAuthStatus', 'authenticated');
    window.location.href = '/'; // Redirect back to home page
    return { ok: true };
  } 
  else if (url === '/.auth/logout' || url.startsWith('/.auth/logout?')) {
    localStorage.setItem('mockAuthStatus', 'unauthenticated');
    window.location.href = '/'; // Redirect back to home page
    return { ok: true };
  }
  else if (url === '/.auth/me') {
    const isAuthenticated = localStorage.getItem('mockAuthStatus') === 'authenticated';
    
    if (isAuthenticated) {
      return {
        ok: true,
        json: async () => ({ clientPrincipal: {
          identityProvider: "aad",
          userId: "test-user-id", 
          userDetails: "test@example.com",
          userRoles: ["authenticated"]
        }})
      };
    } else {
      return {
        ok: true,
        json: async () => ({ clientPrincipal: null })
      };
    }
  }
  return originalFetch(url, options);
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
