/* auth.js — Login/logout, plain JS, no imports, loads FIRST */

window.doLogin = async function() {
  var token = document.getElementById('login-token').value.trim();
  var err = document.getElementById('login-err');
  err.textContent = '';
  if (!token) { err.textContent = 'Вставь токен'; return; }
  err.textContent = 'Проверяю...';
  try {
    // Verify token + org membership via backend (single source of auth logic)
    var r = await fetch('/api/clinics', { headers: { 'Authorization': 'Bearer ' + token } });
    if (r.status === 401) throw new Error('Invalid token');
    if (r.status === 403) throw new Error('Not a member of the org');
    if (!r.ok) throw new Error('Auth failed: ' + r.status);
    // Get user info for display
    var u = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token } });
    var user = await u.json();
    localStorage.setItem('dp_token', btoa(token));
    localStorage.setItem('dp_user', JSON.stringify({ login: user.login, avatar: user.avatar_url, name: user.name || user.login }));
    location.reload();
  } catch(e) { err.textContent = e.message; }
};

window.doLogout = function() {
  localStorage.clear();
  location.reload();
};

/* Helper used by app.js and other scripts */
window.authHeaders = function() {
  var t = localStorage.getItem('dp_token');
  return t ? { 'Authorization': 'Bearer ' + atob(t) } : {};
};
