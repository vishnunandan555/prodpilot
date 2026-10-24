import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Attach the authenticated operator session to API calls made by every view.
// Login/signup calls simply proceed without a token. This keeps strict backend
// mode compatible with the existing component-level fetch calls.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const token = localStorage.getItem('prodpilot_token');
  if (!token) return nativeFetch(input, init);

  const headers = new Headers(init.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return nativeFetch(input, { ...init, headers });
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
