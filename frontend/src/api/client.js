import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

/**
 * Attach auth headers before every request.
 * Token and waNumber are set dynamically via setAuth().
 */
let _token = null;
let _waNumber = null;

export function setAuth(token, waNumber) {
  _token = token;
  _waNumber = waNumber;
}

client.interceptors.request.use((config) => {
  if (_token) {
    config.headers.Authorization = `Bearer ${_token}`;
  }
  if (_waNumber) {
    config.headers['X-WA-Number'] = _waNumber;
  }
  return config;
});

export default client;
