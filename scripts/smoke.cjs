const http = require('node:http');
const done = (msg, code) => {
  console.log(msg);
  process.exit(code);
};
http
  .get('http://127.0.0.1:9334/json/list', (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => {
      const list = JSON.parse(d);
      const page = list.find((t) => t.type === 'page');
      if (!page) return done('NO_PAGE', 1);
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      ws.onopen = () =>
        ws.send(
          JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: {
              expression:
                "(async()=>{const r={};try{r.title=document.title;r.root=document.getElementById('root').childElementCount;}catch(e){r.uiErr=e.message}try{const h=await window.ayesh.healthCheck();r.health=h;}catch(e){r.healthErr=e.message}try{const c=await window.ayesh.getConfig();r.configKeys=Object.keys(c||{}).length;r.apiKeyMasked=c.api_key;}catch(e){r.configErr=e.message}try{const s=await window.ayesh.listSessions();r.sessions=Array.isArray(s)?s.length:'ERR';}catch(e){r.sessionsErr=e.message}return JSON.stringify(r)})()",
              awaitPromise: true,
              returnByValue: true,
            },
          })
        );
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id === 1) {
          const v = m.result && m.result.result && m.result.result.value;
          return done('EVAL ' + v, 0);
        }
      };
      setTimeout(() => done('WS_TIMEOUT', 2), 5000);
    });
  })
  .on('error', (e) => done('HTTP_ERR ' + e.message, 3));
