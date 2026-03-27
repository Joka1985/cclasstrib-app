import { executarBootstrapAutomatico } from "@/lib/system-bootstrap";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await executarBootstrapAutomatico();
  }
}