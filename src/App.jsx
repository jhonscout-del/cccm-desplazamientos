import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { SyncEngine } from './components/SyncEngine'
import { Login } from './pages/Login'
import { Registro } from './pages/Registro'
import { Home } from './pages/Home'
import { NuevoViaje } from './pages/NuevoViaje'
import { ViajeDetalle } from './pages/ViajeDetalle'
import { Dashboard } from './pages/Dashboard'

function Inicio() {
  const { user } = useAuth()
  return <Navigate to={user.role === 'control' ? '/dashboard' : '/mis-viajes'} replace />
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <SyncEngine />
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/" element={<ProtectedRoute><Inicio /></ProtectedRoute>} />
            <Route
              path="/mis-viajes"
              element={
                <ProtectedRoute roles={['viajero']}>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/viajes/nuevo"
              element={
                <ProtectedRoute roles={['viajero']}>
                  <NuevoViaje />
                </ProtectedRoute>
              }
            />
            <Route
              path="/viajes/:id"
              element={
                <ProtectedRoute>
                  <ViajeDetalle />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute roles={['control']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </HashRouter>
    </AuthProvider>
  )
}

export default App
