(function () {
  var FEEDBACK_ENDPOINT = 'https://5c99bazuj0.execute-api.us-east-1.amazonaws.com/feedback';
  var SPAWN_ENDPOINT = 'https://5c99bazuj0.execute-api.us-east-1.amazonaws.com/spawn';

  function detectSlug() {
    var seg = location.pathname.split('/').filter(Boolean);
    if (seg[0] === 'apps' && seg[1]) return seg[1].toLowerCase();
    return (seg[0] || 'unknown').toLowerCase();
  }

  var CSS = ''
    + '.ef-fb-stack{position:fixed;right:12px;bottom:12px;z-index:2147483000;'
    + 'display:flex;flex-direction:column;align-items:flex-end;gap:8px}'
    + '.ef-fb-btn{background:#111;color:#fff;border:2px solid #fff;padding:10px 14px;'
    + 'font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
    + 'letter-spacing:.04em;text-transform:uppercase;cursor:pointer;'
    + 'border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.25)}'
    + '.ef-fb-btn:hover{background:#fff;color:#111}'
    + '.ef-fb-btn.spawn{background:#ff6b35;color:#111;border-color:#111}'
    + '.ef-fb-btn.spawn:hover{background:#111;color:#ff6b35;border-color:#ff6b35}'
    + '.ef-fb-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.55);'
    + 'display:none;align-items:center;justify-content:center;padding:16px}'
    + '.ef-fb-overlay.open{display:flex}'
    + '.ef-fb-modal{background:#fff;color:#111;width:100%;max-width:420px;padding:20px;'
    + 'border-radius:8px;font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
    + 'box-shadow:0 20px 60px rgba(0,0,0,.35)}'
    + '.ef-fb-modal h3{margin:0 0 6px;font-size:16px}'
    + '.ef-fb-modal p{margin:0 0 12px;font-size:13px;color:#555}'
    + '.ef-fb-modal textarea{width:100%;min-height:110px;padding:10px;border:1px solid #ccc;'
    + 'border-radius:4px;font:inherit;resize:vertical;box-sizing:border-box}'
    + '.ef-fb-modal textarea.short{min-height:70px}'
    + '.ef-fb-row{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}'
    + '.ef-fb-row button{padding:9px 14px;border:1px solid #111;background:#fff;color:#111;'
    + 'cursor:pointer;font:inherit;border-radius:4px}'
    + '.ef-fb-row button.primary{background:#111;color:#fff}'
    + '.ef-fb-row button[disabled]{opacity:.5;cursor:default}'
    + '.ef-fb-status{font-size:12px;color:#555;margin-top:8px;min-height:1em}';

  // Host apps often attach window-level keydown listeners (e.g. Space to
  // start/restart a game) that call preventDefault, which would otherwise
  // swallow characters typed into this textarea. Stop key events from
  // bubbling out to the host page.
  function shieldTextarea(ta) {
    function swallow(e) { e.stopPropagation(); }
    ta.addEventListener('keydown', swallow);
    ta.addEventListener('keyup', swallow);
    ta.addEventListener('keypress', swallow);
  }

  function mount() {
    if (document.getElementById('ef-fb-style')) return;
    var style = document.createElement('style');
    style.id = 'ef-fb-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    var stack = document.createElement('div');
    stack.className = 'ef-fb-stack';

    var spawnBtn = document.createElement('button');
    spawnBtn.className = 'ef-fb-btn spawn';
    spawnBtn.type = 'button';
    spawnBtn.setAttribute('aria-label', 'Spawn a new app');
    spawnBtn.textContent = '+ New App';

    var fbBtn = document.createElement('button');
    fbBtn.className = 'ef-fb-btn';
    fbBtn.type = 'button';
    fbBtn.setAttribute('aria-label', 'Send feedback');
    fbBtn.textContent = 'Feedback';

    stack.appendChild(spawnBtn);
    stack.appendChild(fbBtn);

    var fbOverlay = document.createElement('div');
    fbOverlay.className = 'ef-fb-overlay';
    fbOverlay.innerHTML = ''
      + '<div class="ef-fb-modal" role="dialog" aria-labelledby="ef-fb-title">'
      + '<h3 id="ef-fb-title">Send feedback</h3>'
      + '<p>What worked, what broke, what would make this better?</p>'
      + '<textarea maxlength="2000" placeholder="Type anything..."></textarea>'
      + '<div class="ef-fb-status"></div>'
      + '<div class="ef-fb-row">'
      + '<button type="button" class="ef-fb-cancel">Cancel</button>'
      + '<button type="button" class="primary ef-fb-send">Send</button>'
      + '</div></div>';

    var spawnOverlay = document.createElement('div');
    spawnOverlay.className = 'ef-fb-overlay';
    spawnOverlay.innerHTML = ''
      + '<div class="ef-fb-modal" role="dialog" aria-labelledby="ef-sp-title">'
      + '<h3 id="ef-sp-title">Spawn a new app</h3>'
      + '<p>Kicks off the daily-cycle on the factory. Optional: nudge it toward a theme, mechanic, or vibe. Leave blank for a free pick.</p>'
      + '<textarea class="short" maxlength="2000" placeholder="Optional steering prompt..."></textarea>'
      + '<div class="ef-fb-status"></div>'
      + '<div class="ef-fb-row">'
      + '<button type="button" class="ef-sp-cancel">Cancel</button>'
      + '<button type="button" class="primary ef-sp-send">Spawn</button>'
      + '</div></div>';

    document.body.appendChild(stack);
    document.body.appendChild(fbOverlay);
    document.body.appendChild(spawnOverlay);

    wireFeedback(fbBtn, fbOverlay);
    wireSpawn(spawnBtn, spawnOverlay);
  }

  function wireFeedback(btn, overlay) {
    var textarea = overlay.querySelector('textarea');
    var status = overlay.querySelector('.ef-fb-status');
    var sendBtn = overlay.querySelector('.ef-fb-send');
    var cancelBtn = overlay.querySelector('.ef-fb-cancel');

    shieldTextarea(textarea);

    function open() {
      overlay.classList.add('open');
      status.textContent = '';
      setTimeout(function () { textarea.focus(); }, 30);
    }
    function close() { overlay.classList.remove('open'); }
    function reset() {
      textarea.value = '';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }

    btn.addEventListener('click', open);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    sendBtn.addEventListener('click', function () {
      var text = textarea.value.trim();
      if (!text) {
        status.textContent = 'Add a note first.';
        return;
      }
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
      status.textContent = '';

      fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: detectSlug(), text: text })
      }).then(function (r) {
        if (!r.ok) throw new Error('http_' + r.status);
        return r.json();
      }).then(function () {
        status.textContent = 'Thanks — got it.';
        setTimeout(function () { close(); reset(); }, 1200);
      }).catch(function () {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Retry';
        status.textContent = 'Send failed. Try again?';
      });
    });
  }

  function wireSpawn(btn, overlay) {
    var textarea = overlay.querySelector('textarea');
    var status = overlay.querySelector('.ef-fb-status');
    var sendBtn = overlay.querySelector('.ef-sp-send');
    var cancelBtn = overlay.querySelector('.ef-sp-cancel');

    shieldTextarea(textarea);

    function open() {
      overlay.classList.add('open');
      status.textContent = '';
      setTimeout(function () { textarea.focus(); }, 30);
    }
    function close() { overlay.classList.remove('open'); }
    function reset() {
      textarea.value = '';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Spawn';
    }

    btn.addEventListener('click', open);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    sendBtn.addEventListener('click', function () {
      var prompt = textarea.value.trim();
      sendBtn.disabled = true;
      sendBtn.textContent = 'Spawning...';
      status.textContent = '';

      fetch(SPAWN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: detectSlug(), prompt: prompt })
      }).then(function (r) {
        if (!r.ok) throw new Error('http_' + r.status);
        return r.json();
      }).then(function () {
        status.textContent = 'Queued — the factory will pick it up.';
        setTimeout(function () { close(); reset(); }, 1500);
      }).catch(function () {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Retry';
        status.textContent = 'Send failed. Try again?';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
