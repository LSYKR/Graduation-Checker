export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadEnvironment } = await import("./shared/config/environment");
    loadEnvironment();
    console.info(JSON.stringify({event:"application_initialized",runtime:"node",transcripts:"browser-only"}));
  }
}
