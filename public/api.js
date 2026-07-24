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



/* ─── INTERMAVEN LUXURY TOAST & ALERT SYSTEM ─── */

(function injectToastStyles() {
  if (typeof document === 'undefined' || document.getElementById('intermavenToastStyles')) return;
  const style = document.createElement('style');
  style.id = 'intermavenToastStyles';
  style.textContent = `
    #intermavenToastContainer {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      max-width: 420px;
      width: calc(100vw - 48px);
    }

    .im-toast-card {
      pointer-events: auto;
      background: rgba(16, 18, 22, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--b2, #26292e);
      border-left: 4px solid var(--lime, #D7DF23);
      border-radius: 8px;
      padding: 14px 18px;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 20px rgba(215, 223, 35, 0.15);
      display: flex;
      align-items: flex-start;
      gap: 12px;
      opacity: 0;
      transform: translateX(60px) scale(0.95);
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
    }

    .im-toast-card.show {
      opacity: 1;
      transform: translateX(0) scale(1);
    }

    .im-toast-card.success {
      border-left-color: #D7DF23;
      box-shadow: 0 12px 36px rgba(0,0,0,0.5), 0 0 24px rgba(215, 223, 35, 0.25);
    }

    .im-toast-card.error {
      border-left-color: #FF4A4A;
      box-shadow: 0 12px 36px rgba(0,0,0,0.5), 0 0 24px rgba(255, 74, 74, 0.25);
    }

    .im-toast-card.info {
      border-left-color: #00E5FF;
      box-shadow: 0 12px 36px rgba(0,0,0,0.5), 0 0 24px rgba(0, 229, 255, 0.25);
    }

    .im-toast-card.warning {
      border-left-color: #FFB800;
      box-shadow: 0 12px 36px rgba(0,0,0,0.5), 0 0 24px rgba(255, 184, 0, 0.25);
    }

    .im-toast-icon {
      font-size: 20px;
      line-height: 1;
      margin-top: 2px;
      flex-shrink: 0;
    }

    .im-toast-card.success .im-toast-icon { color: #D7DF23; }
    .im-toast-card.error .im-toast-icon { color: #FF4A4A; }
    .im-toast-card.info .im-toast-icon { color: #00E5FF; }
    .im-toast-card.warning .im-toast-icon { color: #FFB800; }

    .im-toast-content {
      flex: 1;
    }

    .im-toast-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.2px;
      margin-bottom: 2px;
    }

    .im-toast-msg {
      font-size: 12.5px;
      color: rgba(255, 255, 255, 0.78);
      line-height: 1.45;
    }

    .im-toast-close {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      font-size: 16px;
      cursor: pointer;
      padding: 0;
      margin-left: 6px;
      transition: color 0.2s;
      line-height: 1;
    }

    .im-toast-close:hover {
      color: #fff;
    }

    .im-toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: currentColor;
      width: 100%;
      transform-origin: left;
      animation: imToastProgress 4s linear forwards;
    }

    .im-toast-card.success .im-toast-progress { color: #D7DF23; }
    .im-toast-card.error .im-toast-progress { color: #FF4A4A; }
    .im-toast-card.info .im-toast-progress { color: #00E5FF; }
    .im-toast-card.warning .im-toast-progress { color: #FFB800; }

    @keyframes imToastProgress {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }

    /* Executive Alert Modal Overlay */
    #imAlertOverlay {
      position: fixed;
      inset: 0;
      z-index: 99999999;
      background: rgba(8, 10, 12, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    #imAlertOverlay.open {
      opacity: 1;
      pointer-events: auto;
    }

    .im-alert-box {
      background: #121418;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 28px 32px;
      max-width: 460px;
      width: 100%;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(215, 223, 35, 0.1);
      transform: scale(0.92);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      text-align: center;
    }

    #imAlertOverlay.open .im-alert-box {
      transform: scale(1);
    }

    .im-alert-icon-wrap {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: rgba(215, 223, 35, 0.1);
      border: 1px solid rgba(215, 223, 35, 0.3);
      color: #D7DF23;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      margin: 0 auto 16px;
    }

    .im-alert-title {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
    }

    .im-alert-body {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.75);
      line-height: 1.5;
      margin-bottom: 24px;
    }

    .im-alert-btn {
      background: #D7DF23;
      color: #000;
      font-weight: 700;
      font-size: 14px;
      padding: 10px 28px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .im-alert-btn:hover {
      background: #e5eb44;
      box-shadow: 0 4px 14px rgba(215, 223, 35, 0.4);
    }
  `;
  document.head.appendChild(style);
})();

function showToast(message, type = 'success', title = '') {
  if (typeof document === 'undefined') return;
  let container = document.getElementById('intermavenToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'intermavenToastContainer';
    document.body.appendChild(container);
  }

  const iconMap = {
    success: 'ri-checkbox-circle-fill',
    error: 'ri-error-warning-fill',
    warning: 'ri-alert-fill',
    info: 'ri-information-fill'
  };

  const titleMap = {
    success: title || 'Success',
    error: title || 'Action Failed',
    warning: title || 'Notice',
    info: title || 'System Notification'
  };

  const card = document.createElement('div');
  card.className = `im-toast-card ${type}`;
  card.innerHTML = `
    <i class="${iconMap[type] || iconMap.success} im-toast-icon"></i>
    <div class="im-toast-content">
      <div class="im-toast-title">${titleMap[type]}</div>
      <div class="im-toast-msg">${message}</div>
    </div>
    <button class="im-toast-close" onclick="(this.parentElement.remove ? this.parentElement.remove() : (this.parentElement.parentNode && this.parentElement.parentNode.removeChild(this.parentElement)))"><i class="ri-close-line"></i></button>
    <div class="im-toast-progress"></div>
  `;

  container.appendChild(card);
  setTimeout(() => card.classList.add('show'), 10);

  setTimeout(() => {
    card.classList.remove('show');
    setTimeout(() => (card.remove ? card.remove() : (card.parentNode && card.parentNode.removeChild(card))), 400);
  }, 4000);
}

function showCustomAlert(message, title = 'System Notification', iconCls = 'ri-notification-3-line') {
  return new Promise(resolve => {
    if (typeof document === 'undefined') return resolve(true);
    let overlay = document.getElementById('imAlertOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'imAlertOverlay';
      overlay.innerHTML = `
        <div class="im-alert-box">
          <div class="im-alert-icon-wrap" id="imAlertIconWrap"><i id="imAlertIcon" class="ri-notification-3-line"></i></div>
          <div class="im-alert-title" id="imAlertTitle">Notification</div>
          <div class="im-alert-body" id="imAlertBody">Message content</div>
          <button type="button" class="im-alert-btn" id="imAlertConfirmBtn">Acknowledge</button>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    const titleEl = document.getElementById('imAlertTitle');
    const bodyEl = document.getElementById('imAlertBody');
    const iconEl = document.getElementById('imAlertIcon');
    const btnEl = document.getElementById('imAlertConfirmBtn');

    if (titleEl) titleEl.innerText = title;
    if (bodyEl) bodyEl.innerText = message;
    if (iconEl) iconEl.className = iconCls;

    overlay.classList.add('open');

    const handleConfirm = () => {
      overlay.classList.remove('open');
      btnEl.onclick = null;
      resolve(true);
    };

    btnEl.onclick = handleConfirm;
  });
}

// Override native browser alert with dark glass toast notification
if (typeof window !== 'undefined') {
  window.alert = function(msg) {
    let cleanMsg = String(msg || '').trim();
    let isSuccess = cleanMsg.includes('✅') || cleanMsg.includes('Success') || cleanMsg.includes('saved') || cleanMsg.includes('successfully');
    let isError = cleanMsg.includes('❌') || cleanMsg.includes('Failed') || cleanMsg.includes('Error') || cleanMsg.includes('Please');
    let isInfo = cleanMsg.includes('📋') || cleanMsg.includes('✨') || cleanMsg.includes('Notice');

    cleanMsg = cleanMsg.replace(/^[✅❌📋✨]s*/, '');

    if (isError) {
      showToast(cleanMsg, 'error', 'Action Required');
    } else if (isSuccess) {
      showToast(cleanMsg, 'success', 'System Confirmed');
    } else if (isInfo) {
      showToast(cleanMsg, 'info', 'Intermaven Notice');
    } else {
      showToast(cleanMsg, 'success', 'Notification');
    }
  };
}
