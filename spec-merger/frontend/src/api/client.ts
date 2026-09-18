import axios from 'axios'

export const client = axios.create({ baseURL: '/api' })

// Le backend renvoie toujours { message } (include-message: always, voir application.yml) :
// on le remonte tel quel pour que l'UI affiche l'erreur réelle plutôt qu'un message générique.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : undefined
    return Promise.reject(message ? new Error(message) : error)
  },
)
