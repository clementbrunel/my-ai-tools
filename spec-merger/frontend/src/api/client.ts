import axios from 'axios'
import { authEnabled, getAccessToken, login } from '../auth/oidc'

// BASE_URL is "/" in dev and the deployment sub-path (e.g. "/spec-merger/") in a build.
export const client = axios.create({ baseURL: `${import.meta.env.BASE_URL}api` })

client.interceptors.request.use(async (config) => {
  const token = await getAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

// Le backend renvoie toujours { message } (include-message: always, voir application.yml) :
// on le remonte tel quel pour que l'UI affiche l'erreur réelle plutôt qu'un message générique.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token refused or expired beyond renewal: sign in again rather than showing a bare 401.
    if (authEnabled && axios.isAxiosError(error) && error.response?.status === 401) {
      void login()
    }
    const message =
      axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : undefined
    return Promise.reject(message ? new Error(message) : error)
  },
)
