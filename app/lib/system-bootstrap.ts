import { bootstrapBibliotecaCClassTrib, precisaBootstrapBiblioteca } from "@/lib/bootstrap-biblioteca";

declare global {
  // eslint-disable-next-line no-var
  var __cclasstrib_bootstrap_executado__: boolean | undefined;
}

export async function executarBootstrapAutomatico() {
  if (process.env.DISABLE_AUTO_BOOTSTRAP === "true") {
    console.log("[cClassTrib] Bootstrap automático desabilitado por variável de ambiente.");
    return;
  }

  if (global.__cclasstrib_bootstrap_executado__) {
    return;
  }

  global.__cclasstrib_bootstrap_executado__ = true;

  try {
    const precisaBootstrap = await precisaBootstrapBiblioteca();

    if (!precisaBootstrap) {
      console.log("[cClassTrib] Biblioteca base já existente. Bootstrap automático não necessário.");
      return;
    }

    console.log("[cClassTrib] Biblioteca base ausente. Executando bootstrap automático...");

    const resultado = await bootstrapBibliotecaCClassTrib();

    console.log("[cClassTrib] Bootstrap automático concluído.", resultado.resumo);
  } catch (error) {
    global.__cclasstrib_bootstrap_executado__ = false;

    console.error(
      "[cClassTrib] Erro no bootstrap automático:",
      error instanceof Error ? error.message : error
    );
  }
}