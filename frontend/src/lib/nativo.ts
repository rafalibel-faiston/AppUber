// Ponte com o plugin nativo Android (captura de ofertas via acessibilidade).
// No navegador tudo isso é no-op.
import { Capacitor, registerPlugin } from "@capacitor/core";

interface VolantePluginDef {
  configurar(o: { apiBase: string; token: string; custoPorKm: string }): Promise<void>;
  status(): Promise<{ acessibilidade: boolean; nativo: boolean }>;
  abrirAcessibilidade(): Promise<void>;
}

export function ehAppNativo(): boolean {
  return Capacitor.isNativePlatform();
}

let _plugin: VolantePluginDef | null = null;
function plugin(): VolantePluginDef | null {
  if (!ehAppNativo()) return null;
  if (!_plugin) _plugin = registerPlugin<VolantePluginDef>("Volante");
  return _plugin;
}

export async function configurarCaptura(token: string, custoPorKm: number): Promise<void> {
  const p = plugin();
  if (!p) return;
  try {
    await p.configurar({
      apiBase: window.location.origin,
      token,
      custoPorKm: String(custoPorKm ?? 0),
    });
  } catch {
    /* ignora */
  }
}

export async function statusCaptura(): Promise<{ acessibilidade: boolean } | null> {
  const p = plugin();
  if (!p) return null;
  try {
    return await p.status();
  } catch {
    return null;
  }
}

export async function abrirAcessibilidade(): Promise<void> {
  const p = plugin();
  if (!p) return;
  try {
    await p.abrirAcessibilidade();
  } catch {
    /* ignora */
  }
}
