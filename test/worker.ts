// Minimal entry for the Workers test pool; tests call modules directly instead of the app.
export default {
  fetch: () => new Response("test worker"),
} satisfies ExportedHandler;
