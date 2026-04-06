export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { executarBootstrapAutomatico } = await import("@/lib/system-bootstrap");
    await executarBootstrapAutomatico();
  }
}