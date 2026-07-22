package com.volante.driver;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte entre o app web e o serviço de acessibilidade que lê as ofertas.
 * O web guarda aqui a URL da API, o token e o custo por km; o serviço nativo
 * usa isso para avaliar e registrar as corridas.
 */
@CapacitorPlugin(name = "Volante")
public class VolantePlugin extends Plugin {

    public static final String PREFS = "volante";

    @PluginMethod
    public void configurar(PluginCall call) {
        SharedPreferences p = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        p.edit()
                .putString("apiBase", call.getString("apiBase", ""))
                .putString("token", call.getString("token", ""))
                .putString("custoPorKm", call.getString("custoPorKm", "0"))
                .apply();
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("acessibilidade", acessibilidadeAtiva());
        r.put("nativo", true);
        call.resolve(r);
    }

    @PluginMethod
    public void abrirAcessibilidade(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    private boolean acessibilidadeAtiva() {
        Context ctx = getContext();
        String ativos = Settings.Secure.getString(
                ctx.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (TextUtils.isEmpty(ativos)) return false;
        String pkg = ctx.getPackageName();
        return ativos.contains(pkg + "/" + OfertaService.class.getName())
                || ativos.contains(pkg + "/.OfertaService");
    }
}
