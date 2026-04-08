// Minimal Anthropic Messages API client. Tests mock it via dependency injection.
export async function callClaude({ apiKey, model = "claude-haiku-4-5-20251001", system, user, tool }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: user }],
      tools: tool ? [tool] : undefined,
      tool_choice: tool ? { type: "tool", name: tool.name } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const block = json.content?.find((c) => c.type === "tool_use");
  return block?.input ?? null;
}
