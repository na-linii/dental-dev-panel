/* auth.js — Login/logout, plain JS, no imports, loads FIRST */

window.doLogin = async function() {
  var token = document.getElementById('login-token').value.trim();
  var err = document.getElementById('login-err');
  err.textContent = '';
  if (!token) { err.textContent = 'Вставь токен'; return; }
  err.textContent = 'Проверяю...';
  try {
    var r = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('Invalid token');
    var user = await r.json();
    var r2 = await fetch('https://api.github.com/orgs/na-linii/members/' + user.login, { headers: { Authorization: 'Bearer ' + token } });
    if (r2.status !== 204) throw new Error('Not a member of na-linii');
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
