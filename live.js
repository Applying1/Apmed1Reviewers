/* Live updates over Supabase Realtime "broadcast" (no table access, nothing stored).
   A page joins a topic (e.g. "discuss:pharma:p6_1_3"); after posting or deleting it sends a tiny "changed" ping, and every other
   open page on that topic reloads at once. Phones that sleep lose the socket: it reconnects (and the caller should reload then). */
window.Live = (() => {
  let ws = null, ref = 0, hb = null, wait = 1000, cloud = null;
  const subs = {};                       // topic -> {on, onOpen}
  const url = () => cloud.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(cloud.key) + '&vsn=1.0.0';
  const send = m => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(Object.assign({ ref: String(++ref) }, m))); return true } return false };
  const join = t => send({ topic: 'realtime:' + t, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } }, join_ref: String(ref + 1) });
  function connect() {
    if (!cloud || ws) return;
    try { ws = new WebSocket(url()) } catch (e) { ws = null; return }
    ws.onopen = () => {
      wait = 1000;
      Object.keys(subs).forEach(t => { join(t); try { subs[t].onOpen && subs[t].onOpen() } catch (e) {} });
      hb = setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {} }), 25000);
    };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data) } catch (x) { return }
      if (m.event !== 'broadcast') return;
      const t = String(m.topic || '').replace(/^realtime:/, ''), s = subs[t];
      if (s) try { s.on((m.payload || {}).payload || {}) } catch (x) {}
    };
    ws.onclose = () => { clearInterval(hb); ws = null; if (Object.keys(subs).length) setTimeout(connect, wait = Math.min(wait * 2, 30000)) };
    ws.onerror = () => { try { ws.close() } catch (e) {} };
  }
  // back from sleep or another tab: make sure the socket is alive
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !ws) connect() });
  return {
    // Live.listen(cloud, topic, onMessage, onReconnect)
    listen(c, topic, on, onOpen) { cloud = c; subs[topic] = { on, onOpen }; if (ws && ws.readyState === 1) join(topic); else connect() },
    // Live.ping(topic, data): tell the others something changed
    ping(topic, data) {
      const msg = { type: 'broadcast', event: 'changed', payload: data || {} };
      // the socket can only send on topics this page has joined; anything else goes through the REST endpoint
      if (subs[topic] && send({ topic: 'realtime:' + topic, event: 'broadcast', payload: msg })) return;
      if (!cloud) return;
      fetch(cloud.url + '/realtime/v1/api/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cloud.key },
        body: JSON.stringify({ messages: [{ topic, event: 'changed', payload: data || {}, private: false }] }) }).catch(() => {});
    },
  };
})();
