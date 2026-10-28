// Google sign-in through Supabase Auth, shared by pages that need to act as the signed-in person (discussion).
// The session (access + refresh token) stays in this browser only; the account's name/photo/email are kept for display.
const Auth = {
  ACC: 'reviewer_account', SES: 'reviewer_session', SYNC: 'reviewer_sync',
  cloud: null,
  base() { return this.cloud.url.replace(/\/+$/, ''); },
  acc() { try { return JSON.parse(localStorage.getItem(this.ACC)) || null; } catch (e) { return null; } },
  ses() { try { return JSON.parse(localStorage.getItem(this.SES)) || null; } catch (e) { return null; } },
  set(k, v) { try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch (e) {} },
  signIn(back) { location.href = this.base() + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(back || location.href.split('#')[0]); },
  saveSession(h) {
    this.set(this.SES, { access: h.access_token, refresh: h.refresh_token, exp: Date.now() + (+h.expires_in || 3600) * 1000 - 60000 });
  },
  // a publishable key (sb_publishable_…) is not a login token: send it only as apikey, never as Authorization
  headers(tok) { const h = { 'Content-Type': 'application/json', apikey: this.cloud.key }; if (tok || /^eyJ/.test(this.cloud.key)) h.Authorization = 'Bearer ' + (tok || this.cloud.key); return h; },
  // Back from Google (#access_token=...): keep the session, link this device's sync code, remember name and photo.
  async finish() {
    const h = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
    if (!h.access_token && !h.error) return null;
    history.replaceState(null, '', location.pathname + location.search);
    if (h.error) throw new Error((h.error_description || 'Sign-in was cancelled.').replace(/\+/g, ' '));
    this.saveSession(h);
    const hd = this.headers(h.access_token);
    let code = '';
    try { code = (JSON.parse(localStorage.getItem(this.SYNC)) || {}).code || ''; } catch (e) {}
    const acct = await fetch(this.base() + '/rest/v1/rpc/account_code', { method: 'POST', headers: hd, body: JSON.stringify({ p_code: code || null }) }).then(r => r.ok ? r.json() : '');
    if (/^[A-Z0-9]{12}$/.test(acct || '')) this.set(this.SYNC, { code: acct });
    const u = await fetch(this.base() + '/auth/v1/user', { headers: hd }).then(r => r.ok ? r.json() : {});
    const m = u.user_metadata || {};
    const a = { name: m.full_name || m.name || '', email: u.email || m.email || '', avatar: m.avatar_url || m.picture || '', at: Date.now() };
    this.set(this.ACC, a);
    return a;
  },
  // A valid access token, refreshed when it has expired; '' when signed out or the refresh failed.
  // Only one page refreshes at a time (Supabase rotates refresh tokens, so a second use of the old one is refused);
  // the others wait and then use the new token. The session is dropped only when the server refuses the refresh
  // token, never because the phone was offline or the server had a hiccup.
  async token() {
    const s = this.ses();
    if (!s || !s.access) return '';
    if (Date.now() < s.exp) return s.access;
    try { if (navigator.locks) return await navigator.locks.request('reviewer-auth-refresh', () => this.refresh()); } catch (e) {}
    return this.refresh();
  },
  async refresh() {
    const s = this.ses();
    if (!s || !s.access) return '';
    if (Date.now() < s.exp) return s.access;   // another page refreshed while this one waited
    let r;
    try { r = await fetch(this.base() + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: this.headers(), body: JSON.stringify({ refresh_token: s.refresh }) }); }
    catch (e) { return ''; }                   // offline: keep the session for later
    if (r.ok) { try { const h = await r.json(); if (h.access_token) { this.saveSession(h); return h.access_token; } } catch (e) {} return ''; }
    if (r.status >= 500 || r.status === 429) return '';
    const now = this.ses();                    // refused: unless another page already got a new one, the sign-in has ended
    if (now && now.refresh !== s.refresh) return now.access;
    this.set(this.SES, null);
    return '';
  },
  // Signed in before, but this device's session has ended (refresh refused): show "Sign in again".
  ended() { return !!this.acc() && !this.ses(); },
  async rpc(fn, body, signedIn) {
    const tok = signedIn ? await this.token() : '';
    const r = await fetch(this.base() + '/rest/v1/rpc/' + fn, { method: 'POST', headers: this.headers(tok), body: JSON.stringify(body || {}) });
    const t = await r.text();
    if (!r.ok) { let m = ''; try { m = JSON.parse(t).message || ''; } catch (e) {} throw new Error(m || 'Server error ' + r.status); }
    return t ? JSON.parse(t) : null;
  },
};
