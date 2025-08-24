import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { setupMockAuth } from './utils/mockAuth';

// Setup mock authentication for local development
// This wraps the fetch API to add authentication headers
setupMockAuth();

// Set mock auth status in localStorage for local development
localStorage.setItem('mockAuthStatus', 'authenticated');

// Setup mock response for /.auth/me endpoint
const originalFetch = window.fetch;
window.fetch = async (url, options) => {
  if (url === '/.auth/me') {
    return {
      ok: true,
      json: async () => ({ clientPrincipal: {
        identityProvider: "aad",
        userId: "test-user-id", 
        userDetails: "test@example.com",
        userRoles: ["authenticated"]
      }})
    };
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
