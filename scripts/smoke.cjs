const http = require("node:http");
const done = (msg, code) => {
  console.log(msg);
  process.exit(code);
};
http
  .get("http://127.0.0.1:9334/json/list", (res) => {
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", () => {
      const list = JSON.parse(d);
      const page = list.find((t) => t.type === "page");
      if (!page) return done("NO_PAGE", 1);
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      ws.onopen = () =>
        ws.send(
          JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: {
              expression:
                "(async()=>{const r={};try{r.title=document.title;r.root=document.getElementById('root').childElementCount;}catch(e){r.uiErr=e.message}try{const h=await window.ayesh.healthCheck();r.health=h;}catch(e){r.healthErr=e.message}try{const c=await window.ayesh.getConfig();r.configKeys=Object.keys(c||{}).length;r.apiKeyMasked=c.api_key;}catch(e){r.configErr=e.message}try{const s=await window.ayesh.listSessions();r.sessions=Array.isArray(s)?s.length:'ERR';}catch(e){r.sessionsErr=e.message}try{window.__off=window.ayesh.onChunk(c=>{r.chunks=(r.chunks||0)+1;if(c.done)r.doneChunk=true;});window.ayesh.sendMessage('halo','smoke-'+Date.now()).then(()=>r.streamState='resolved').catch(e=>r.streamState='rejected:'+(e&&e.message));}catch(e){r.streamErr=e.message}            const t0=Date.now();while(Date.now()-t0<40000&&!r.doneChunk){await new Promise(x=>setTimeout(x,300));}r.streamState=r.streamState||'timeout';try{window.__off&&window.__off();}catch(e){}return JSON.stringify(r)})()",
              awaitPromise: true,
              returnByValue: true,
            },
          }),
        );
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id === 1) {
          const v = m.result && m.result.result && m.result.result.value;
          let parsed = null;
          try {
            parsed = JSON.parse(v);
          } catch {
            /* v bukan JSON; biarkan lolos sebagai EVAL biasa */
          }
          if (parsed && !parsed.uiErr && !parsed.doneChunk) {
            return done("STREAM_FAIL " + v, 4);
          }
          return done("EVAL " + v, 0);
        }
      };
      setTimeout(() => done("WS_TIMEOUT", 2), 55000);
    });
  })
  .on("error", (e) => done("HTTP_ERR " + e.message, 3));
