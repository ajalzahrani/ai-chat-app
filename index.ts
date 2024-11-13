import { serve, file } from "bun";
import { join } from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = serve({
  port: 3000,
  async fetch(req, server) {
    const url = new URL(req.url);

    // Handle WebSocket upgrade
    if (server.upgrade(req)) {
      return;
    }

    // Serve static files
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(file(join(__dirname, "frontend", "index.html")));
    }

    // Serve other static files
    try {
      return new Response(file(join(__dirname, "frontend", url.pathname)));
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  },
  websocket: {
    async message(ws, message) {
      try {
        const response = await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama3",
            prompt: message,
            stream: true,
          }),
        });

        const reader = response.body?.getReader();
        if (!reader) return;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split("\n").filter(Boolean);

          for (const line of lines) {
            const data = JSON.parse(line);
            if (data.response) {
              ws.send(JSON.stringify({ response: data.response }));
            }
          }
        }
      } catch (error) {
        ws.send(
          JSON.stringify({ error: "Failed to get response from Ollama" })
        );
      }
    },
  },
});

console.log(`Server running on port ${server.port}`);
