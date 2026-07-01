import { Router } from 'express'
import { requireAuth } from '../auth.js'

export const authRouter = Router()

// El login ocurre en el navegador contra Microsoft (MSAL). Esta ruta solo
// confirma la identidad ya validada por el middleware y da de alta al
// usuario en la base local la primera vez que se conecta.
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})
