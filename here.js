/* "Here now" (Oct 31): tells the cloud this device has a page of the site open and visible, so the owner's Site stats can show
   how many devices are on the site right now (any page, idle or studying). Counts only: a random device code (only its md5 is
   stored), no names, no pages. Sent at most once a minute and only while the page is visible. Loaded by update.js. */
(function () {
  if (window.top !== window || !window.fetch) return;
  const DK = 'reviewer_dev'; let mem = null, cloud = null, last = 0;
  function dev() {
    let d = null; try { d = localStorage.getItem(DK) } catch (e) { }
    if (!d) d = mem;
    if (!d || !/^[A-Za-z0-9]{16,64}$/.test(d)) {
      d = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); mem = d;
      try { localStorage.setItem(DK, d) } catch (e) { }
    }
    return d;
  }
  function ping() {
    if (!cloud || document.visibilityState !== 'visible' || Date.now() - last < 55e3) return;
    last = Date.now();
    const h = { 'Content-Type': 'application/json', apikey: cloud.key }; if (/^eyJ/.test(cloud.key)) h.Authorization = 'Bearer ' + cloud.key;
    fetch(cloud.url + '/rest/v1/rpc/here_ping', { method: 'POST', headers: h, body: JSON.stringify({ p_dev: dev() }), keepalive: true }).catch(() => { });
  }
  fetch('courses.json').then(r => r.json()).then(l => {
    const c = (l.find(x => x.cloud && x.cloud.url) || {}).cloud; if (!c || !c.key) return;
    cloud = c; setTimeout(ping, 1500); setInterval(ping, 60e3);
    document.addEventListener('visibilitychange', ping);
  }).catch(() => { });
})();
