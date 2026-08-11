# Your Custom AI Chatbot

A small, self-hosted assistant you can embed on your website. It has two parts:

- **`server.js`** — a backend that securely calls the OpenAI API (your API key never
  reaches the browser).
- **`public/widget.js`** — a single script tag you drop into any page to add a
  chat bubble in the corner.

## 1. Get an OpenAI API key

1. Go to https://platform.openai.com/api-keys
2. Create a key, and add billing (the API is pay-as-you-go, separate from a
   ChatGPT subscription).

## 2. Set up the project

```bash
npm install
cp .env.example .env
```

Open `.env` and paste in your key:

```
OPENAI_API_KEY=sk-...
```

## 3. Customize your assistant

Open `server.js` and edit the `SYSTEM_PROMPT` constant — this is where you tell
the assistant who it is, what it knows, and how it should behave. For example:

```js
const SYSTEM_PROMPT = `You are the support assistant for Acme Co.
Answer questions about our pricing, shipping, and returns policy.
If asked something outside that scope, politely say you're not able to help
and suggest emailing support@acme.com.`;
```

You can also change the model (e.g. `gpt-4o`, `gpt-4o-mini`) in `.env`.

## 4. Run it locally

```bash
npm start
```

Visit http://localhost:3000 — you'll see a demo page with the chat bubble
working live.

## 5. Add it to your real website

Once you deploy the server somewhere (see below), add this one line to any
page on your site, right before `</body>`:

```html
<script src="https://your-server-domain.com/widget.js"
        data-api-url="https://your-server-domain.com/api/chat"
        data-name="Assistant"
        data-greeting="Hi! What can I help you with?"></script>
```

- `data-api-url` — where your backend is running
- `data-name` — the name shown in the chat header
- `data-greeting` — the first message shown when someone opens the chat

## 6. Deploy the backend

This is a standard Node/Express app, so it runs on most hosts. A few easy options:

- **Render** or **Railway** — connect your GitHub repo, set the `OPENAI_API_KEY`
  environment variable in their dashboard, deploy.
- **Fly.io** or a small VPS — `npm install && npm start` behind a process
  manager like `pm2`.

Whichever you use, set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) as an
environment variable there — never commit your real `.env` file.

## Notes on cost & safety

- Every message sent through the widget costs a small amount via the OpenAI
  API (pennies per conversation with `gpt-4o-mini`). Keep an eye on usage at
  platform.openai.com.
- The server includes basic rate limiting (20 messages/minute per visitor) to
  avoid runaway costs from abuse — tune `RATE_LIMIT` in `server.js` if needed.
- Conversation history is only kept in the visitor's browser tab (sent with
  each request) — nothing is stored server-side by default.

## File structure

```
website-chatbot/
├── server.js          # Backend API (calls OpenAI, keeps your key private)
├── package.json
├── .env.example        # Copy to .env and fill in your key
└── public/
    ├── index.html      # Demo page showing the widget in action
    └── widget.js        # The embeddable chat widget itself
```
