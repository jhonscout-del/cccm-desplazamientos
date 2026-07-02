import { PublicClientApplication } from '@azure/msal-browser'

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: '/',
  },
  cache: {
    // localStorage (no sessionStorage) para que la sesión sobreviva cierres
    // de la app y funcione al reabrir sin conexión.
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
}

// Scope de nuestra propia API (expuesto por el App Registration del backend),
// necesario para que el token que reciba Express tenga la audiencia correcta.
export const API_SCOPES = [import.meta.env.VITE_AZURE_API_SCOPE]

// Scope delegado de Microsoft Graph para enviar el correo desde la cuenta
// del propio usuario que inició sesión (audiencia distinta a API_SCOPES).
export const MAIL_SCOPES = ['Mail.Send']

export const msalInstance = new PublicClientApplication(msalConfig)
export const msalReady = msalInstance.initialize()
