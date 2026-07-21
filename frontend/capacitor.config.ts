import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.volante.driver",
  appName: "Volante",
  webDir: "dist",
  // O app nativo carrega o site publicado no Railway (sempre a versão mais nova).
  // Se sua URL mudar, troque aqui e gere o APK de novo.
  server: {
    url: "https://appuber-production.up.railway.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0b0d14",
  },
};

export default config;
