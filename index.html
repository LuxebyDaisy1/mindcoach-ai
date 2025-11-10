<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MindCoach ✨</title>
  <style>
    :root {
      --brand: #a2e0ff;
      --accent: #87c8de;
      --text: #222;
      --bg: #f9fafb;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: "Inter", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }

    .card {
      width: 100%;
      max-width: 700px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    header {
      background: linear-gradient(135deg, var(--brand), var(--accent));
      color: #fff;
      padding: 16px 20px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .subtitle {
      font-weight: 400;
      font-size: 0.9rem;
      color: #f5f5f5;
    }

    .controls {
      background: #f7f7f7;
      padding: 10px 20px;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    label {
      font-size: 0.9rem;
      color: #333;
      margin-right: 6px;
    }

    select {
      padding: 6px;
      border-radius: 6px;
      border: 1px solid #ccc;
      background: #fff;
    }

    #log {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      scroll-behavior: smooth;
    }

    .msg {
      margin: 10px 0;
      padding: 12px 16px;
      border-radius: 10px;
      line-height: 1.4;
      white-space: pre-wrap;
      max-width: 90%;
    }

    .you {
      background: #e9f7ff;
      align-self: flex-end;
      border: 1px solid #bde0f6;
    }

    .ai {
      background: #f6f6f6;
      border: 1px solid #e1e1e1;
      align-self: flex-start;
    }

    .row {
      display: flex;
      border-top: 1px solid #eee;
      background: #fafafa;
      padding: 10px;
      gap: 10px;
    }

    input {
      flex: 1;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #ccc;
      font-size: 1rem;
    }

    button {
      background: var(--brand);
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      cursor: pointer;
      font-weight: 600;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    @keyframes dots {
      0% { content: ""; }
      33% { content: "."; }
      66% { content: ".."; }
      100% { content: "..."; }
    }

    .dots::after {
      content: "";
      animation: dots 1.5s steps(3, end) infinite;
    }
  </style>
</head>

<body>
  <div class="card">
    <header>
      <div>
        MindCoach 💎
        <div class="subtitle">You matter. You’re heard. Calm guidance in every language by LuxeMind.</div>
      </div>
    </header>

    <div class="controls">
      <label for="langSelect">Language:</label>
      <select id="langSelect">
        <option value="auto" selected>Auto (detect)</option>
        <option value="es">Español</option>
        <option value="en">English</option>
        <option value="both">Both (ES + EN)</option>
      </select>
    </div>

    <div id="log"></div>

    <div class="row">
      <input id="msg" type="text" placeholder="Say hola / hi / bonjour..." />
      <button id="send">Send</button>
    </div>
  </div>

  <script>
    const log = document.getElementById("log");
    const input = document.getElementById("msg");
    const btn = document.getElementById("send");
    const langSelect = document.getElementById("langSelect");

    function add(role, text) {
      const div = document.createElement("div");
      div.className = "msg " + (role === "You" ? "you" : "ai");
      div.innerHTML = `<strong>${role}:</strong> ${text}`;
      log.appendChild(div);
      div.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    async function send() {
      const message = input.value.trim();
      if (!message) return;

      add("You", message);
      input.value = "";
      btn.disabled = true;
      btn.textContent = "Thinking…";

      const typingDiv = document.createElement("div");
      typingDiv.className = "msg ai";
      typingDiv.innerHTML = `<em>MindCoach is typing<span class="dots"></span></em>`;
      log.appendChild(typingDiv);
      typingDiv.scrollIntoView({ behavior: "smooth", block: "end" });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            langMode: langSelect.value
          })
        });
        const data = await res.json();
        typingDiv.remove();
        add("MindCoach", data.text ?? data.error ?? "No response.");
      } catch (err) {
        typingDiv.remove();
        add("MindCoach", "⚠️ Network error. Please try again.");
      } finally {
        btn.disabled = false;
        btn.textContent = "Send";
      }
    }

    btn.onclick = send;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });
  </script>
</body>
</html>