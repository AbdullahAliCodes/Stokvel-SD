import { supabase } from '../utils/supabase.js'

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or malformed authorization header',
      })
    }

    const token = authHeader.split(' ')[1]

    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data?.user) {
      return res.status(401).json({
        error: error?.message || 'Invalid token',
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
    }

    req.user = { ...data.user, role: profile?.role || 'user' }
    next()
  } catch (err) {
    console.error('Auth Middleware Error:', err)
    res.status(500).json({
      error: 'Internal Server Error during authentication',
    })
  }
}
