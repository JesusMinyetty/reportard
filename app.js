let map = null;
let selectedCategory = null;
let reportMarkersLayer = null;
let reporteSeleccionado = null;

function getClient() {
  if (!window.sb) {
    alert('Supabase no está configurado. Revisa supabase-client.js y tus claves.');
    throw new Error('Supabase client missing');
  }
  return window.sb;
}

function go(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screenId);
  });

  if (screenId === 'mapa') {
    if (!map) {
      setTimeout(() => {
        initMap();
        cargarReportesEnMapa();
      }, 200);
    } else {
      setTimeout(() => {
        map.invalidateSize();
        cargarReportesEnMapa();
      }, 120);
    }
  }

  if (screenId === 'feed') {
    cargarFeed();
  }

  if (screenId === 'perfil') {
    cargarPerfil();
  }

  if (screenId === 'detalle') {
    setTimeout(mostrarDetalle, 80);
  }
}

function initMap() {
  if (map) return;

  if (typeof L === 'undefined') {
    console.error('Leaflet no está cargado.');
    return;
  }

  map = L.map('map', { zoomControl: false }).setView([18.4861, -69.9312], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  reportMarkersLayer = L.layerGroup().addTo(map);
}

function selectCat(el) {
  document.querySelectorAll('.cat-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');

  selectedCategory =
    el.querySelector('.cat-label')?.innerText?.trim() ||
    el.innerText.trim();
}

function generateTrackingNumber() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `RD-${new Date().getFullYear()}-${random}`;
}

function obtenerUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no soportada'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

function mapearUrgencia() {
  const select = document.getElementById('reporte-urgencia');
  if (!select || !select.value) return 'medio';
  return select.value;
}

function modoAnonimo() {
  go('mapa');
}

async function iniciarApp() {
  try {
    if (!window.sb) {
      go('login');
      return;
    }

    const { data } = await window.sb.auth.getSession();

    if (data?.session) {
      go('mapa');
    } else {
      go('login');
    }
  } catch (err) {
    console.error(err);
    go('login');
  }
}

async function registrarUsuario() {
  try {
    const sb = getClient();

    const fullName = document.getElementById('registro-nombre')?.value.trim() || '';
    const email = document.getElementById('registro-email')?.value.trim() || '';
    const phone = document.getElementById('registro-telefono')?.value.trim() || '';
    const sector = document.getElementById('registro-sector')?.value || '';
    const password = document.getElementById('registro-password')?.value || '';

    if (!fullName || !email || !phone || !sector || !password) {
      alert('Completa todos los campos del registro.');
      return;
    }

    if (password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          sector
        }
      }
    });

    if (error) {
      alert('No se pudo crear la cuenta: ' + error.message);
      return;
    }

    const user = data?.user;
    const session = data?.session;

    if (!user) {
      alert('La cuenta se creó, pero no se pudo obtener el usuario.');
      return;
    }

    if (!session) {
      alert('Cuenta creada. Revisa tu correo para confirmar el acceso y luego inicia sesión.');
      go('login');
      return;
    }

    const { error: profileError } = await sb.from('profiles').upsert({
      id: user.id,
      full_name: fullName,
      email,
      phone,
      sector
    });

    if (profileError) {
      console.error(profileError);
      alert('La cuenta se creó, pero falló guardar el perfil: ' + profileError.message);
      return;
    }

    alert('Cuenta creada correctamente.');
    go('mapa');

  } catch (err) {
    console.error(err);
    alert('Ocurrió un error creando la cuenta.');
  }
}

async function loginUsuario() {
  try {
    const sb = getClient();

    const email = document.getElementById('login-email')?.value.trim() || '';
    const password = document.getElementById('login-password')?.value || '';

    if (!email || !password) {
      alert('Escribe tu correo y contraseña.');
      return;
    }

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert('No se pudo iniciar sesión: ' + error.message);
      return;
    }

    if (!data.session) {
      alert('Sesión no creada. Revisa si tienes que confirmar el correo en Supabase Auth.');
      return;
    }

    go('mapa');

  } catch (err) {
    console.error(err);
    alert('Ocurrió un error iniciando sesión.');
  }
}

async function logoutUsuario() {
  try {
    const sb = getClient();
    await sb.auth.signOut();

    selectedCategory = null;
    reporteSeleccionado = null;

    go('login');
  } catch (err) {
    console.error(err);
  }
}

async function cargarPerfil() {
  const avatar = document.getElementById('perfil-avatar');
  const nombreEl = document.getElementById('perfil-nombre');
  const sectorEl = document.getElementById('perfil-sector');

  try {
    const sb = getClient();

    const { data: authData } = await sb.auth.getUser();
    const user = authData?.user;

    if (!user) {
      if (avatar) avatar.innerText = 'AN';
      if (nombreEl) nombreEl.innerText = 'Usuario Anónimo';
      if (sectorEl) sectorEl.innerText = 'Modo anónimo';
      return;
    }

    const { data, error } = await sb
      .from('profiles')
      .select('full_name, phone, sector, email')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
    }

    let full_name =
      data?.full_name ||
      user.user_metadata?.full_name ||
      user.email ||
      'Usuario';

    let sector =
      data?.sector ||
      user.user_metadata?.sector ||
      'República Dominicana';

    if (!data) {
      await sb.from('profiles').upsert({
        id: user.id,
        full_name,
        email: user.email,
        phone: user.user_metadata?.phone || '',
        sector
      });
    }

    if (avatar) avatar.innerText = full_name.slice(0, 2).toUpperCase();
    if (nombreEl) nombreEl.innerText = full_name;
    if (sectorEl) sectorEl.innerText = sector;

  } catch (err) {
    console.error(err);
  }
}

async function enviarReporte() {
  const btn = document.getElementById('btn-enviar-reporte');
  if (btn) btn.disabled = true;

  try {
    const sb = getClient();

    if (!selectedCategory) {
      alert('Selecciona el tipo de incidente.');
      return;
    }

    const descripcion = document.getElementById('reporte-descripcion')?.value.trim() || '';
    const ubicacion = document.getElementById('reporte-ubicacion')?.value.trim() || '';
    const urgencia = mapearUrgencia();

    if (!descripcion || !ubicacion) {
      alert('Completa la descripción y la ubicación.');
      return;
    }

    const { data: authData } = await sb.auth.getUser();
    const user = authData?.user;

    let latitude = 18.4861;
    let longitude = -69.9312;

    try {
      const ubicacionReal = await obtenerUbicacion();
      latitude = ubicacionReal.lat;
      longitude = ubicacionReal.lng;
    } catch (error) {
      console.warn('GPS no disponible.');
    }

    const tracking_number = generateTrackingNumber();

    const fileInput = document.getElementById('input-evidencia');
    let image_url = null;

    if (fileInput && fileInput.files.length > 0) {
      image_url = await subirImagen(fileInput.files[0]);
    }

    const { data, error } = await sb
      .from('reports')
      .insert({
        user_id: user?.id || null,
        report_type: selectedCategory,
        description: descripcion,
        location_text: ubicacion,
        urgency: urgencia,
        latitude,
        longitude,
        status: 'en_revision',
        tracking_number,
        image_url
      })
      .select()
      .single();

    if (error) {
      console.error('ERROR SUPABASE:', error);
      alert('No se pudo guardar el reporte: ' + error.message);
      return;
    }

    const trackingEl = document.getElementById('tracking-number');
    if (trackingEl) {
      trackingEl.innerText = `#${data.tracking_number}`;
    }

    resetReportForm();
    go('confirmacion');

  } catch (err) {
    console.error('ERROR GENERAL:', err);
    alert('Ocurrió un error enviando el reporte.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function resetReportForm() {
  selectedCategory = null;

  document.querySelectorAll('.cat-item').forEach(i => i.classList.remove('selected'));

  const descripcion = document.getElementById('reporte-descripcion');
  const ubicacion = document.getElementById('reporte-ubicacion');
  const urgencia = document.getElementById('reporte-urgencia');
  const fileInput = document.getElementById('input-evidencia');

  if (descripcion) descripcion.value = '';
  if (ubicacion) ubicacion.value = '';
  if (urgencia) urgencia.value = 'medio';
  if (fileInput) fileInput.value = '';
}

async function subirImagen(file) {
  try {
    const sb = getClient();

    const fileName = `${Date.now()}-${file.name}`;

    const { error } = await sb.storage
      .from('evidencias')
      .upload(fileName, file);

    if (error) {
      console.error('ERROR STORAGE:', error);
      alert('No se pudo subir la evidencia. El reporte se enviará sin imagen.');
      return null;
    }

    const { data } = sb.storage
      .from('evidencias')
      .getPublicUrl(fileName);

    return data?.publicUrl || null;

  } catch (err) {
    console.error(err);
    return null;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function getReportEmoji(type) {
  if (!type) return '⚠️';

  const t = type.toLowerCase();

  if (t.includes('robo') || t.includes('asalto')) return '🔪';
  if (t.includes('vehículo') || t.includes('vehiculo')) return '🚗';
  if (t.includes('narcotráfico') || t.includes('narcotrafico')) return '💊';
  if (t.includes('vandalismo')) return '🏚️';
  if (t.includes('sospechoso')) return '👁️';
  if (t.includes('accidente')) return '🚨';
  if (t.includes('disparos')) return '🔫';
  if (t.includes('emergencia')) return '🆘';

  return '⚠️';
}

function formatStatus(status) {
  const map = {
    en_revision: 'En revisión',
    resuelto: 'Resuelto',
    verificado: 'Verificado'
  };

  return map[status] || status || 'Pendiente';
}

async function cargarFeed() {
  try {
    const sb = getClient();

    const contenedor = document.getElementById('feed-list');
    if (!contenedor) return;

    const { data, error } = await sb
      .from('reports')
      .select(`
        report_type,
        urgency,
        description,
        location_text,
        created_at,
        status,
        latitude,
        longitude,
        tracking_number,
        image_url
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    contenedor.innerHTML = '';

    if (!data || data.length === 0) {
      contenedor.innerHTML = `
        <div class="card">
          <p style="font-size:13px; color:#757575;">
            Todavía no hay reportes publicados.
          </p>
        </div>
      `;
      return;
    }

    data.forEach(r => {
      const item = document.createElement('div');
      item.className = 'incident-item';

      item.onclick = () => {
        reporteSeleccionado = r;
        go('detalle');
        setTimeout(mostrarDetalle, 100);
      };

      const badgeClass =
        r.urgency === 'critico' ? 'badge-red' :
        r.urgency === 'alto' ? 'badge-orange' :
        r.urgency === 'bajo' ? 'badge-green' :
        'badge-yellow';

      const emoji = getReportEmoji(r.report_type);

      item.innerHTML = `
        <div class="incident-icon" style="background:#ffebee;">
          ${emoji}
        </div>

        <div class="incident-info">
          <div class="incident-title">
            ${escapeHtml(r.report_type || 'Reporte')}
          </div>

          <div class="incident-meta">
            📍 ${escapeHtml(r.location_text || 'Sin ubicación')}
          </div>

          <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
            <span class="badge ${badgeClass}">
              ${escapeHtml(r.urgency || 'Sin urgencia')}
            </span>
            <span style="font-size:11px; color:#9e9e9e;">
              ${formatRelativeTime(r.created_at)}
            </span>
          </div>
        </div>
      `;

      contenedor.appendChild(item);
    });

  } catch (err) {
    console.error(err);
  }
}

function mostrarDetalle() {
  if (!reporteSeleccionado) return;

  const titulo = document.getElementById('detalle-titulo');
  const tipo = document.getElementById('detalle-tipo');
  const fecha = document.getElementById('detalle-fecha');
  const estado = document.getElementById('detalle-estado');
  const ubicacion = document.getElementById('detalle-ubicacion');
  const descripcion = document.getElementById('detalle-descripcion');
  const evidencias = document.getElementById('detalle-evidencias');

  if (titulo) titulo.innerText = reporteSeleccionado.report_type || 'Reporte';
  if (tipo) tipo.innerText = reporteSeleccionado.report_type || 'Tipo';

  if (fecha) {
    fecha.innerText = reporteSeleccionado.created_at
      ? new Date(reporteSeleccionado.created_at).toLocaleString()
      : '--';
  }

  if (estado) estado.innerText = formatStatus(reporteSeleccionado.status);

  if (ubicacion) {
    ubicacion.innerText = `📍 ${reporteSeleccionado.location_text || 'Sin ubicación'}`;
  }

  if (descripcion) {
    descripcion.innerText = reporteSeleccionado.description || 'Sin descripción';
  }

  if (evidencias) {
    evidencias.innerHTML = '';

    if (reporteSeleccionado.image_url) {
      const img = document.createElement('img');
      img.src = reporteSeleccionado.image_url;
      img.style.width = '100%';
      img.style.maxHeight = '220px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '12px';
      evidencias.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.width = '80px';
      placeholder.style.height = '80px';
      placeholder.style.background = '#e0e0e0';
      placeholder.style.borderRadius = '12px';
      placeholder.style.display = 'flex';
      placeholder.style.alignItems = 'center';
      placeholder.style.justifyContent = 'center';
      placeholder.style.fontSize = '28px';
      placeholder.textContent = '📷';
      evidencias.appendChild(placeholder);
    }
  }
}

function formatRelativeTime(iso) {
  if (!iso) return '';

  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);

  if (min < 1) return 'Hace unos segundos';
  if (min === 1) return 'Hace 1 min';
  if (min < 60) return `Hace ${min} min`;

  const h = Math.floor(min / 60);

  if (h === 1) return 'Hace 1 hora';

  return `Hace ${h} horas`;
}

function getMarkerIcon() {
  return L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}

async function cargarReportesEnMapa() {
  try {
    const sb = getClient();

    if (!map || !reportMarkersLayer) return;

    reportMarkersLayer.clearLayers();

    const { data, error } = await sb
      .from('reports')
      .select('report_type, location_text, latitude, longitude, created_at');

    if (error) {
      console.error(error);
      return;
    }

    const icon = getMarkerIcon();

    (data || []).forEach(r => {
      if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return;

      const popup = `
        <b>${escapeHtml(r.report_type || 'Reporte')}</b><br>
        📍 ${escapeHtml(r.location_text || 'Sin ubicación')}<br>
        🕐 ${escapeHtml(formatRelativeTime(r.created_at))}
      `;

      L.marker([r.latitude, r.longitude], { icon })
        .addTo(reportMarkersLayer)
        .bindPopup(popup);
    });

  } catch (err) {
    console.error(err);
  }
}

function showToast() {
  const t = document.getElementById('toast');
  if (!t) return;

  t.style.display = 'flex';

  setTimeout(() => {
    t.style.display = 'none';
  }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(iniciarApp, 1200);
});

window.go = go;
window.loginUsuario = loginUsuario;
window.registrarUsuario = registrarUsuario;
window.enviarReporte = enviarReporte;
window.logoutUsuario = logoutUsuario;
window.selectCat = selectCat;
window.showToast = showToast;
window.mostrarDetalle = mostrarDetalle;
window.modoAnonimo = modoAnonimo;let map = null;
let selectedCategory = null;
let reportMarkersLayer = null;
let reporteSeleccionado = null;

function getClient() {
  if (!window.sb) {
    alert('Supabase no está configurado. Revisa supabase-client.js y tus claves.');
    throw new Error('Supabase client missing');
  }
  return window.sb;
}

function go(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screenId);
  });

  if (screenId === 'mapa') {
    if (!map) {
      setTimeout(() => {
        initMap();
        cargarReportesEnMapa();
      }, 200);
    } else {
      setTimeout(() => {
        map.invalidateSize();
        cargarReportesEnMapa();
      }, 120);
    }
  }

  if (screenId === 'feed') {
    cargarFeed();
  }

  if (screenId === 'perfil') {
    cargarPerfil();
  }

  if (screenId === 'detalle') {
    setTimeout(mostrarDetalle, 80);
  }
}

function initMap() {
  if (map) return;

  if (typeof L === 'undefined') {
    console.error('Leaflet no está cargado.');
    return;
  }

  map = L.map('map', { zoomControl: false }).setView([18.4861, -69.9312], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  reportMarkersLayer = L.layerGroup().addTo(map);
}

function selectCat(el) {
  document.querySelectorAll('.cat-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');

  selectedCategory =
    el.querySelector('.cat-label')?.innerText?.trim() ||
    el.innerText.trim();
}

function generateTrackingNumber() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `RD-${new Date().getFullYear()}-${random}`;
}

function obtenerUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no soportada'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

function mapearUrgencia() {
  const select = document.getElementById('reporte-urgencia');
  if (!select || !select.value) return 'medio';
  return select.value;
}

function modoAnonimo() {
  go('mapa');
}

async function iniciarApp() {
  try {
    if (!window.sb) {
      go('login');
      return;
    }

    const { data } = await window.sb.auth.getSession();

    if (data?.session) {
      go('mapa');
    } else {
      go('login');
    }
  } catch (err) {
    console.error(err);
    go('login');
  }
}

async function registrarUsuario() {
  try {
    const sb = getClient();

    const fullName = document.getElementById('registro-nombre')?.value.trim() || '';
    const email = document.getElementById('registro-email')?.value.trim() || '';
    const phone = document.getElementById('registro-telefono')?.value.trim() || '';
    const sector = document.getElementById('registro-sector')?.value || '';
    const password = document.getElementById('registro-password')?.value || '';

    if (!fullName || !email || !phone || !sector || !password) {
      alert('Completa todos los campos del registro.');
      return;
    }

    if (password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          sector
        }
      }
    });

    if (error) {
      alert('No se pudo crear la cuenta: ' + error.message);
      return;
    }

    const user = data?.user;
    const session = data?.session;

    if (!user) {
      alert('La cuenta se creó, pero no se pudo obtener el usuario.');
      return;
    }

    if (!session) {
      alert('Cuenta creada. Revisa tu correo para confirmar el acceso y luego inicia sesión.');
      go('login');
      return;
    }

    const { error: profileError } = await sb.from('profiles').upsert({
      id: user.id,
      full_name: fullName,
      email,
      phone,
      sector
    });

    if (profileError) {
      console.error(profileError);
      alert('La cuenta se creó, pero falló guardar el perfil: ' + profileError.message);
      return;
    }

    alert('Cuenta creada correctamente.');
    go('mapa');

  } catch (err) {
    console.error(err);
    alert('Ocurrió un error creando la cuenta.');
  }
}

async function loginUsuario() {
  try {
    const sb = getClient();

    const email = document.getElementById('login-email')?.value.trim() || '';
    const password = document.getElementById('login-password')?.value || '';

    if (!email || !password) {
      alert('Escribe tu correo y contraseña.');
      return;
    }

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert('No se pudo iniciar sesión: ' + error.message);
      return;
    }

    if (!data.session) {
      alert('Sesión no creada. Revisa si tienes que confirmar el correo en Supabase Auth.');
      return;
    }

    go('mapa');

  } catch (err) {
    console.error(err);
    alert('Ocurrió un error iniciando sesión.');
  }
}

async function logoutUsuario() {
  try {
    const sb = getClient();
    await sb.auth.signOut();

    selectedCategory = null;
    reporteSeleccionado = null;

    go('login');
  } catch (err) {
    console.error(err);
  }
}

async function cargarPerfil() {
  const avatar = document.getElementById('perfil-avatar');
  const nombreEl = document.getElementById('perfil-nombre');
  const sectorEl = document.getElementById('perfil-sector');

  try {
    const sb = getClient();

    const { data: authData } = await sb.auth.getUser();
    const user = authData?.user;

    if (!user) {
      if (avatar) avatar.innerText = 'AN';
      if (nombreEl) nombreEl.innerText = 'Usuario Anónimo';
      if (sectorEl) sectorEl.innerText = 'Modo anónimo';
      return;
    }

    const { data, error } = await sb
      .from('profiles')
      .select('full_name, phone, sector, email')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
    }

    let full_name =
      data?.full_name ||
      user.user_metadata?.full_name ||
      user.email ||
      'Usuario';

    let sector =
      data?.sector ||
      user.user_metadata?.sector ||
      'República Dominicana';

    if (!data) {
      await sb.from('profiles').upsert({
        id: user.id,
        full_name,
        email: user.email,
        phone: user.user_metadata?.phone || '',
        sector
      });
    }

    if (avatar) avatar.innerText = full_name.slice(0, 2).toUpperCase();
    if (nombreEl) nombreEl.innerText = full_name;
    if (sectorEl) sectorEl.innerText = sector;

  } catch (err) {
    console.error(err);
  }
}

async function enviarReporte() {
  const btn = document.getElementById('btn-enviar-reporte');
  if (btn) btn.disabled = true;

  try {
    const sb = getClient();

    if (!selectedCategory) {
      alert('Selecciona el tipo de incidente.');
      return;
    }

    const descripcion = document.getElementById('reporte-descripcion')?.value.trim() || '';
    const ubicacion = document.getElementById('reporte-ubicacion')?.value.trim() || '';
    const urgencia = mapearUrgencia();

    if (!descripcion || !ubicacion) {
      alert('Completa la descripción y la ubicación.');
      return;
    }

    const { data: authData } = await sb.auth.getUser();
    const user = authData?.user;

    let latitude = 18.4861;
    let longitude = -69.9312;

    try {
      const ubicacionReal = await obtenerUbicacion();
      latitude = ubicacionReal.lat;
      longitude = ubicacionReal.lng;
    } catch (error) {
      console.warn('GPS no disponible.');
    }

    const tracking_number = generateTrackingNumber();

    const fileInput = document.getElementById('input-evidencia');
    let image_url = null;

    if (fileInput && fileInput.files.length > 0) {
      image_url = await subirImagen(fileInput.files[0]);
    }

    const { data, error } = await sb
      .from('reports')
      .insert({
        user_id: user?.id || null,
        report_type: selectedCategory,
        description: descripcion,
        location_text: ubicacion,
        urgency: urgencia,
        latitude,
        longitude,
        status: 'en_revision',
        tracking_number,
        image_url
      })
      .select()
      .single();

    if (error) {
      console.error('ERROR SUPABASE:', error);
      alert('No se pudo guardar el reporte: ' + error.message);
      return;
    }

    const trackingEl = document.getElementById('tracking-number');
    if (trackingEl) {
      trackingEl.innerText = `#${data.tracking_number}`;
    }

    resetReportForm();
    go('confirmacion');

  } catch (err) {
    console.error('ERROR GENERAL:', err);
    alert('Ocurrió un error enviando el reporte.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function resetReportForm() {
  selectedCategory = null;

  document.querySelectorAll('.cat-item').forEach(i => i.classList.remove('selected'));

  const descripcion = document.getElementById('reporte-descripcion');
  const ubicacion = document.getElementById('reporte-ubicacion');
  const urgencia = document.getElementById('reporte-urgencia');
  const fileInput = document.getElementById('input-evidencia');

  if (descripcion) descripcion.value = '';
  if (ubicacion) ubicacion.value = '';
  if (urgencia) urgencia.value = 'medio';
  if (fileInput) fileInput.value = '';
}

async function subirImagen(file) {
  try {
    const sb = getClient();

    const fileName = `${Date.now()}-${file.name}`;

    const { error } = await sb.storage
      .from('evidencias')
      .upload(fileName, file);

    if (error) {
      console.error('ERROR STORAGE:', error);
      alert('No se pudo subir la evidencia. El reporte se enviará sin imagen.');
      return null;
    }

    const { data } = sb.storage
      .from('evidencias')
      .getPublicUrl(fileName);

    return data?.publicUrl || null;

  } catch (err) {
    console.error(err);
    return null;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function getReportEmoji(type) {
  if (!type) return '⚠️';

  const t = type.toLowerCase();

  if (t.includes('robo') || t.includes('asalto')) return '🔪';
  if (t.includes('vehículo') || t.includes('vehiculo')) return '🚗';
  if (t.includes('narcotráfico') || t.includes('narcotrafico')) return '💊';
  if (t.includes('vandalismo')) return '🏚️';
  if (t.includes('sospechoso')) return '👁️';
  if (t.includes('accidente')) return '🚨';
  if (t.includes('disparos')) return '🔫';
  if (t.includes('emergencia')) return '🆘';

  return '⚠️';
}

function formatStatus(status) {
  const map = {
    en_revision: 'En revisión',
    resuelto: 'Resuelto',
    verificado: 'Verificado'
  };

  return map[status] || status || 'Pendiente';
}

async function cargarFeed() {
  try {
    const sb = getClient();

    const contenedor = document.getElementById('feed-list');
    if (!contenedor) return;

    const { data, error } = await sb
      .from('reports')
      .select(`
        report_type,
        urgency,
        description,
        location_text,
        created_at,
        status,
        latitude,
        longitude,
        tracking_number,
        image_url
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    contenedor.innerHTML = '';

    if (!data || data.length === 0) {
      contenedor.innerHTML = `
        <div class="card">
          <p style="font-size:13px; color:#757575;">
            Todavía no hay reportes publicados.
          </p>
        </div>
      `;
      return;
    }

    data.forEach(r => {
      const item = document.createElement('div');
      item.className = 'incident-item';

      item.onclick = () => {
        reporteSeleccionado = r;
        go('detalle');
        setTimeout(mostrarDetalle, 100);
      };

      const badgeClass =
        r.urgency === 'critico' ? 'badge-red' :
        r.urgency === 'alto' ? 'badge-orange' :
        r.urgency === 'bajo' ? 'badge-green' :
        'badge-yellow';

      const emoji = getReportEmoji(r.report_type);

      item.innerHTML = `
        <div class="incident-icon" style="background:#ffebee;">
          ${emoji}
        </div>

        <div class="incident-info">
          <div class="incident-title">
            ${escapeHtml(r.report_type || 'Reporte')}
          </div>

          <div class="incident-meta">
            📍 ${escapeHtml(r.location_text || 'Sin ubicación')}
          </div>

          <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
            <span class="badge ${badgeClass}">
              ${escapeHtml(r.urgency || 'Sin urgencia')}
            </span>
            <span style="font-size:11px; color:#9e9e9e;">
              ${formatRelativeTime(r.created_at)}
            </span>
          </div>
        </div>
      `;

      contenedor.appendChild(item);
    });

  } catch (err) {
    console.error(err);
  }
}

function mostrarDetalle() {
  if (!reporteSeleccionado) return;

  const titulo = document.getElementById('detalle-titulo');
  const tipo = document.getElementById('detalle-tipo');
  const fecha = document.getElementById('detalle-fecha');
  const estado = document.getElementById('detalle-estado');
  const ubicacion = document.getElementById('detalle-ubicacion');
  const descripcion = document.getElementById('detalle-descripcion');
  const evidencias = document.getElementById('detalle-evidencias');

  if (titulo) titulo.innerText = reporteSeleccionado.report_type || 'Reporte';
  if (tipo) tipo.innerText = reporteSeleccionado.report_type || 'Tipo';

  if (fecha) {
    fecha.innerText = reporteSeleccionado.created_at
      ? new Date(reporteSeleccionado.created_at).toLocaleString()
      : '--';
  }

  if (estado) estado.innerText = formatStatus(reporteSeleccionado.status);

  if (ubicacion) {
    ubicacion.innerText = `📍 ${reporteSeleccionado.location_text || 'Sin ubicación'}`;
  }

  if (descripcion) {
    descripcion.innerText = reporteSeleccionado.description || 'Sin descripción';
  }

  if (evidencias) {
    evidencias.innerHTML = '';

    if (reporteSeleccionado.image_url) {
      const img = document.createElement('img');
      img.src = reporteSeleccionado.image_url;
      img.style.width = '100%';
      img.style.maxHeight = '220px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '12px';
      evidencias.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.width = '80px';
      placeholder.style.height = '80px';
      placeholder.style.background = '#e0e0e0';
      placeholder.style.borderRadius = '12px';
      placeholder.style.display = 'flex';
      placeholder.style.alignItems = 'center';
      placeholder.style.justifyContent = 'center';
      placeholder.style.fontSize = '28px';
      placeholder.textContent = '📷';
      evidencias.appendChild(placeholder);
    }
  }
}

function formatRelativeTime(iso) {
  if (!iso) return '';

  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);

  if (min < 1) return 'Hace unos segundos';
  if (min === 1) return 'Hace 1 min';
  if (min < 60) return `Hace ${min} min`;

  const h = Math.floor(min / 60);

  if (h === 1) return 'Hace 1 hora';

  return `Hace ${h} horas`;
}

function getMarkerIcon() {
  return L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}

async function cargarReportesEnMapa() {
  try {
    const sb = getClient();

    if (!map || !reportMarkersLayer) return;

    reportMarkersLayer.clearLayers();

    const { data, error } = await sb
      .from('reports')
      .select('report_type, location_text, latitude, longitude, created_at');

    if (error) {
      console.error(error);
      return;
    }

    const icon = getMarkerIcon();

    (data || []).forEach(r => {
      if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return;

      const popup = `
        <b>${escapeHtml(r.report_type || 'Reporte')}</b><br>
        📍 ${escapeHtml(r.location_text || 'Sin ubicación')}<br>
        🕐 ${escapeHtml(formatRelativeTime(r.created_at))}
      `;

      L.marker([r.latitude, r.longitude], { icon })
        .addTo(reportMarkersLayer)
        .bindPopup(popup);
    });

  } catch (err) {
    console.error(err);
  }
}

function showToast() {
  const t = document.getElementById('toast');
  if (!t) return;

  t.style.display = 'flex';

  setTimeout(() => {
    t.style.display = 'none';
  }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(iniciarApp, 1200);
});

window.go = go;
window.loginUsuario = loginUsuario;
window.registrarUsuario = registrarUsuario;
window.enviarReporte = enviarReporte;
window.logoutUsuario = logoutUsuario;
window.selectCat = selectCat;
window.showToast = showToast;
window.mostrarDetalle = mostrarDetalle;
window.modoAnonimo = modoAnonimo;