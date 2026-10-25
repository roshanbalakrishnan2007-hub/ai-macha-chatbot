(function () {
  // ---- Configuration ----
  // Point this at wherever your server.js is running/deployed.
  const API_URL = (document.currentScript && document.currentScript.getAttribute('data-api-url')) || '/api/chat';
  const ASSISTANT_NAME = (document.currentScript && document.currentScript.getAttribute('data-name')) || 'Assistant';
  const GREETING = (document.currentScript && document.currentScript.getAttribute('data-greeting')) || "Hi! What can I help you with?";

  // ---- Styles (scoped with a unique prefix to avoid clashing with host site) ----
  const css = `
    .wcb-launcher {
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #6D1B8F 0%, #E0407A 55%, #F5A524 100%); color: #fff; border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 6px 20px rgba(224,64,122,0.45);
      transition: transform 0.15s ease;
    }
    .wcb-launcher:hover { transform: scale(1.06); }
    .wcb-launcher svg { width: 24px; height: 24px; }

    .wcb-panel {
      position: fixed; bottom: 92px; right: 24px; z-index: 999999;
      width: 340px; max-width: calc(100vw - 32px);
      height: 480px; max-height: calc(100vh - 140px);
      background: #ffeef8; border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.18);
      display: none; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    }
    .wcb-panel.wcb-open { display: flex; }

    .wcb-header {
      background: linear-gradient(135deg, #6D1B8F 0%, #E0407A 55%, #F5A524 100%); color: #fff; padding: 14px 16px;
      font-size: 15px; font-weight: 600; display: flex;
      align-items: center; justify-content: space-between;
    }
    .wcb-header-close { cursor: pointer; opacity: 0.75; font-size: 18px; line-height: 1; background:none; border:none; color:#fff; }
    .wcb-header-close:hover { opacity: 1; }

    .wcb-messages {
      flex: 1; overflow-y: auto; padding: 14px; background: linear-gradient(165deg, #e9d9ff 0%, #ffd3e8 55%, #ffe5bd 100%);
      display: flex; flex-direction: column; gap: 10px;
    }
    .wcb-msg { max-width: 82%; padding: 9px 12px; border-radius: 12px; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; }
    .wcb-msg-user { align-self: flex-end; background: linear-gradient(135deg, #6D1B8F 0%, #E0407A 55%, #F5A524 100%); color: #fff; border-bottom-right-radius: 3px; }
    .wcb-msg-bot { align-self: flex-start; background: #fff; color: #232030; border: 1px solid #f2cfe3; border-bottom-left-radius: 3px; }
    .wcb-msg-img { display: block; max-width: 100%; border-radius: 8px; margin-top: 8px; }
    .wcb-msg-typing { align-self: flex-start; background: #fff; border: 1px solid #f2cfe3; border-radius: 12px; padding: 10px 14px; }
    .wcb-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #E0407A; margin-right: 3px; animation: wcb-bounce 1.2s infinite; }
    .wcb-dot:nth-child(2) { animation-delay: 0.15s; }
    .wcb-dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes wcb-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-3px); opacity: 1; } }

    .wcb-inputrow { display: flex; border-top: 1px solid #f2cfe3; padding: 10px; gap: 8px; background: #ffeef8; }
    .wcb-input {
      flex: 1; border: 1px solid #ddd8ea; border-radius: 20px; padding: 9px 14px;
      font-size: 13.5px; outline: none; font-family: inherit;
    }
    .wcb-input:focus { border-color: #E0407A; box-shadow: 0 0 0 3px rgba(224,64,122,0.18); }
    .wcb-send {
      background: linear-gradient(135deg, #6D1B8F 0%, #E0407A 55%, #F5A524 100%); color: #fff; border: none; border-radius: 50%;
      width: 36px; height: 36px; flex-shrink: 0; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .wcb-send:disabled { opacity: 0.5; cursor: default; }
  `;
  const styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  // ---- Markup ----
  const launcher = document.createElement('button');
  launcher.className = 'wcb-launcher';
  launcher.setAttribute('aria-label', 'Open chat');
  launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  const panel = document.createElement('div');
  panel.className = 'wcb-panel';
  panel.innerHTML = `
    <div class="wcb-header">
      <span>${ASSISTANT_NAME}</span>
      <button class="wcb-header-close" aria-label="Close chat">×</button>
    </div>
    <div class="wcb-messages"></div>
    <div class="wcb-inputrow">
      <input class="wcb-input" type="text" placeholder="Type a message…" />
      <button class="wcb-send" aria-label="Send">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9 22 2z"/></svg>
      </button>
    </div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('.wcb-messages');
  const inputEl = panel.querySelector('.wcb-input');
  const sendBtn = panel.querySelector('.wcb-send');
  const closeBtn = panel.querySelector('.wcb-header-close');

  let history = [];
  let opened = false;

  function addMessage(role, text, image) {
    const div = document.createElement('div');
    div.className = 'wcb-msg ' + (role === 'user' ? 'wcb-msg-user' : 'wcb-msg-bot');
    div.textContent = text;
    if (image) {
      const img = document.createElement('img');
      img.className = 'wcb-msg-img';
      img.src = image;
      img.alt = 'Generated image';
      div.appendChild(img);
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'wcb-msg-typing';
    div.id = 'wcb-typing';
    div.innerHTML = '<span class="wcb-dot"></span><span class="wcb-dot"></span><span class="wcb-dot"></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('wcb-typing');
    if (el) el.remove();
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    sendBtn.disabled = true;
    addMessage('user', text);
    history.push({ role: 'user', content: text });
    showTyping();

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      hideTyping();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      addMessage('bot', data.reply, data.image);
      history.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      hideTyping();
      addMessage('bot', "Sorry, something went wrong. Please try again in a moment.");
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  launcher.addEventListener('click', () => {
    opened = !opened;
    panel.classList.toggle('wcb-open', opened);
    if (opened && messagesEl.children.length === 0) {
      addMessage('bot', GREETING);
    }
    if (opened) inputEl.focus();
  });

  closeBtn.addEventListener('click', () => {
    opened = false;
    panel.classList.remove('wcb-open');
  });

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
})();
