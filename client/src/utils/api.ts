// API utility for making requests with proper base URL
// Uses environment variable in production, relative paths in development

const getApiBaseUrl = (): string => {
  // In production, use the environment variable or default to Render URL
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_BASE_URL || 'https://devai-b2ui.onrender.com/api';
  }
  // In development, use relative path (Vite proxy will handle it)
  return '/api';
};

export const apiBaseUrl = getApiBaseUrl();

// Helper function to make API requests with proper base URL
export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${apiBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  console.log('🌐 API Request:', {
    endpoint,
    fullUrl: url,
    method: options.method || 'GET',
  });
  
  return fetch(url, options);
};

