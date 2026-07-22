package com.volante.driver;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lê o texto da tela da Uber/99 quando uma oferta aparece, extrai valor e km,
 * avalia se vale a pena (usando o custo por km salvo) e mostra um balão flutuante.
 * O balão permite registrar a corrida direto no Volante.
 */
public class OfertaService extends AccessibilityService {

    private WindowManager wm;
    private View overlay;
    private String ultimaAssinatura = "";
    private long ultimoTs = 0;
    private final Handler handler = new Handler(Looper.getMainLooper());

    // "R$ 13,13" -> vírgula decimal
    private static final Pattern P_VALOR = Pattern.compile("R\\$\\s*([0-9][0-9.]{0,7}[,][0-9]{2})");
    // "3.0 km" / "5,6 km"
    private static final Pattern P_KM = Pattern.compile("([0-9]+[.,][0-9]+)\\s*km");

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        String plataforma = plataformaDe(event.getPackageName().toString());
        if (plataforma == null) return;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;

        List<String> textos = new ArrayList<>();
        coletarTexto(root, textos);
        if (textos.isEmpty()) return;
        String tela = TextUtils.join(" \n ", textos);

        Matcher mv = P_VALOR.matcher(tela);
        if (!mv.find()) return;
        double valor = parseValor(mv.group(1));
        if (valor <= 0) return;

        double km = 0;
        Matcher mk = P_KM.matcher(tela);
        while (mk.find()) km += parseKm(mk.group(1));

        String assinatura = plataforma + "|" + valor + "|" + km;
        long agora = System.currentTimeMillis();
        if (assinatura.equals(ultimaAssinatura) && agora - ultimoTs < 60000) return;
        ultimaAssinatura = assinatura;
        ultimoTs = agora;

        final String plat = plataforma;
        final double v = valor;
        final double k = km;
        handler.post(() -> mostrarOverlay(plat, v, k));
    }

    @Override
    public void onInterrupt() {
    }

    // ---------- parsing ----------

    private String plataformaDe(String pkg) {
        if (pkg.contains("ubercab")) return "uber";
        if (pkg.contains("taxis99") || pkg.contains("99driver")) return "99";
        if (pkg.toLowerCase(Locale.US).contains("indriv")) return "indrive";
        return null;
    }

    private void coletarTexto(AccessibilityNodeInfo node, List<String> out) {
        if (node == null) return;
        CharSequence t = node.getText();
        if (t != null && t.length() > 0) out.add(t.toString());
        CharSequence d = node.getContentDescription();
        if (d != null && d.length() > 0) out.add(d.toString());
        for (int i = 0; i < node.getChildCount(); i++) {
            coletarTexto(node.getChild(i), out);
        }
    }

    private double parseValor(String s) {
        try {
            return Double.parseDouble(s.replace(".", "").replace(",", "."));
        } catch (Exception e) {
            return 0;
        }
    }

    private double parseKm(String s) {
        try {
            return Double.parseDouble(s.replace(",", "."));
        } catch (Exception e) {
            return 0;
        }
    }

    // ---------- overlay ----------

    private void mostrarOverlay(String plataforma, double valor, double km) {
        removerOverlay();

        double custoKm = lerCustoKm();
        double custo = km * custoKm;
        double lucro = valor - custo;

        int cor;
        String titulo;
        if (custoKm <= 0) {
            cor = 0xFFFFB020;
            titulo = "Oferta " + plataforma.toUpperCase(Locale.US);
        } else if (lucro <= 0) {
            cor = 0xFFFF5D6C;
            titulo = "🔴 Prejuízo";
        } else if (km > 0 && (valor / km) >= custoKm * 2) {
            cor = 0xFFFFB020;
            titulo = "🟢 Vale a pena!";
        } else {
            cor = 0xFF6F8DFF;
            titulo = "🟡 Dá pra aceitar";
        }

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16), dp(14), dp(16), dp(14));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xF2141824);
        bg.setCornerRadius(dp(18));
        bg.setStroke(dp(1), cor);
        box.setBackground(bg);

        TextView tTitulo = new TextView(this);
        tTitulo.setText(titulo);
        tTitulo.setTextColor(cor);
        tTitulo.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        tTitulo.setTypeface(tTitulo.getTypeface(), android.graphics.Typeface.BOLD);
        box.addView(tTitulo);

        TextView tInfo = new TextView(this);
        String det = "R$ " + fmt(valor) + "  ·  " + fmt(km) + " km";
        if (custoKm > 0) det += "  ·  lucro R$ " + fmt(lucro);
        tInfo.setText(det);
        tInfo.setTextColor(0xFFEEF1F7);
        tInfo.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        tInfo.setPadding(0, dp(4), 0, dp(10));
        box.addView(tInfo);

        LinearLayout botoes = new LinearLayout(this);
        botoes.setOrientation(LinearLayout.HORIZONTAL);

        Button bReg = new Button(this);
        bReg.setText("Registrar");
        bReg.setAllCaps(false);
        bReg.setTextColor(0xFF14120A);
        GradientDrawable bgReg = new GradientDrawable();
        bgReg.setColor(0xFFFFB020);
        bgReg.setCornerRadius(dp(10));
        bReg.setBackground(bgReg);
        bReg.setOnClickListener(v -> {
            registrarCorrida(plataforma, valor, km);
            removerOverlay();
        });
        LinearLayout.LayoutParams lpReg = new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        lpReg.rightMargin = dp(8);
        botoes.addView(bReg, lpReg);

        Button bFechar = new Button(this);
        bFechar.setText("✕");
        bFechar.setAllCaps(false);
        bFechar.setTextColor(0xFFEEF1F7);
        GradientDrawable bgF = new GradientDrawable();
        bgF.setColor(0xFF232A3D);
        bgF.setCornerRadius(dp(10));
        bFechar.setBackground(bgF);
        bFechar.setOnClickListener(v -> removerOverlay());
        botoes.addView(bFechar, new LinearLayout.LayoutParams(dp(52),
                LinearLayout.LayoutParams.WRAP_CONTENT));

        box.addView(botoes);

        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                dp(260),
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        lp.y = dp(90);

        try {
            wm.addView(box, lp);
            overlay = box;
            handler.postDelayed(this::removerOverlay, 14000);
        } catch (Exception e) {
            overlay = null;
        }
    }

    private void removerOverlay() {
        if (overlay != null && wm != null) {
            try {
                wm.removeView(overlay);
            } catch (Exception ignored) {
            }
            overlay = null;
        }
    }

    // ---------- registrar corrida (POST) ----------

    private void registrarCorrida(String plataforma, double valor, double km) {
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                SharedPreferences p = getSharedPreferences(VolantePlugin.PREFS, Context.MODE_PRIVATE);
                String apiBase = p.getString("apiBase", "");
                String token = p.getString("token", "");
                if (TextUtils.isEmpty(apiBase) || TextUtils.isEmpty(token)) return;

                URL url = new URL(apiBase + "/api/corridas");
                c = (HttpURLConnection) url.openConnection();
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json");
                c.setRequestProperty("Authorization", "Bearer " + token);
                c.setConnectTimeout(10000);
                c.setReadTimeout(10000);
                c.setDoOutput(true);

                String hoje = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                JSONObject body = new JSONObject();
                body.put("valor", valor);
                body.put("plataforma", plataforma);
                body.put("km", km);
                body.put("data", hoje);

                OutputStream os = c.getOutputStream();
                os.write(body.toString().getBytes("UTF-8"));
                os.close();
                c.getResponseCode();
            } catch (Exception ignored) {
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }

    // ---------- util ----------

    private double lerCustoKm() {
        try {
            SharedPreferences p = getSharedPreferences(VolantePlugin.PREFS, Context.MODE_PRIVATE);
            return Double.parseDouble(p.getString("custoPorKm", "0"));
        } catch (Exception e) {
            return 0;
        }
    }

    private String fmt(double v) {
        return String.format(Locale.US, "%.2f", v).replace(".", ",");
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics());
    }
}
