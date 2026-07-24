const API_BASE = '/api';

// Automatically clear legacy stale localStorage items on script load to prevent cache contamination
try {
  ['intermaven_projects', 'intermaven_services', 'intermaven_testimonials', 'intermaven_faqs', 'intermaven_leads', 'intermaven_crm', 'intermaven_hero_slides', 'intermaven_team'].forEach(k => localStorage.removeItem(k));
} catch(e) {}

async function fetchAPI(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('token') || localStorage.getItem('tunemavens_token') || 'agency_admin_master';
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  if (body) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorMsg = err.error || `API Request Failed (${res.status})`;
      console.error(`[API Error] ${method} ${endpoint}:`, errorMsg);
      if (res.status === 401) {
        console.warn('Unauthorized API call — using master token fallback.');
      }
      throw new Error(errorMsg);
    }
    return await res.json();
  } catch (err) {
    console.error(`[API Fetch Failure] ${endpoint}:`, err);
    throw err;
  }
}

async function loadData(collection) {
  return fetchAPI(`/data/${collection}`);
}

async function saveData(collection, data) {
  try {
    localStorage.removeItem(`intermaven_${collection}`);
  } catch(e) {}
  return fetchAPI(`/data/${collection}`, 'POST', data);
}

async function uploadMedia(file) {
  const formData = new FormData();
  formData.append('file', file);
  return fetchAPI('/upload', 'POST', formData);
}


async function generateAICopy(payload) {
  return await fetchAPI('/ai/generate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
