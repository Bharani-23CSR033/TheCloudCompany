import api from './api'

export async function authenticate(mode, form) {
  const { data } = await api.post(`/auth/${mode === 'register' ? 'register' : 'login'}`, form)
  localStorage.setItem('token', data.token)
  return data
}
