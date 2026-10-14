package liberta.bibliainterlinear;

import android.app.Activity;
import android.app.PendingIntent;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import java.util.Arrays;

/**
 * Login Google para guardar as anotações no Drive da pessoa (pasta oculta do app, escopo drive.appdata).
 * Usa a API de autorização do Google Play services: na primeira vez aparece a janela do Google para escolher
 * a conta e permitir; depois o token é renovado em silêncio. O Google reconhece o app pelo pacote
 * e pelo SHA-1 da chave de assinatura (cliente OAuth "Android" no Google Cloud) — não há segredo no app.
 */
@CapacitorPlugin(name = "ContaGoogle")
public class ContaGooglePlugin extends Plugin {
    private static final String DRIVE_APPDATA = "https://www.googleapis.com/auth/drive.appdata";
    private ActivityResultLauncher<IntentSenderRequest> lancador;
    private PluginCall pendente;

    @Override
    public void load() {
        lancador = getActivity().getActivityResultRegistry()
            .register("conta-google", new ActivityResultContracts.StartIntentSenderForResult(), this::voltou);
    }

    @PluginMethod
    public void autorizar(PluginCall call) {
        boolean silencioso = Boolean.TRUE.equals(call.getBoolean("silencioso", false));
        AuthorizationRequest pedido = AuthorizationRequest.builder()
            .setRequestedScopes(Arrays.asList(new Scope("openid"), new Scope("email"), new Scope("profile"), new Scope(DRIVE_APPDATA)))
            .build();
        Identity.getAuthorizationClient(getActivity()).authorize(pedido)
            .addOnSuccessListener(res -> {
                if (res.hasResolution()) {
                    PendingIntent pi = res.getPendingIntent();
                    if (silencioso || pi == null) { call.reject("É preciso confirmar no Google.", "interacao"); return; }
                    if (pendente != null) pendente.reject("Outro login começou.", "cancelado");
                    pendente = call;
                    lancador.launch(new IntentSenderRequest.Builder(pi.getIntentSender()).build());
                } else {
                    responder(call, res);
                }
            })
            .addOnFailureListener(e -> call.reject(e.getMessage() != null ? e.getMessage() : "Falha no login.", "falhou", e));
    }

    @PluginMethod
    public void sair(PluginCall call) {
        // O token some da memória do app; para revogar de vez: myaccount.google.com › Segurança › Apps com acesso.
        call.resolve();
    }

    private void voltou(ActivityResult r) {
        PluginCall call = pendente;
        pendente = null;
        if (call == null) return;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null) { call.reject("Login cancelado.", "cancelado"); return; }
        try {
            responder(call, Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(r.getData()));
        } catch (ApiException e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Falha no login.", "falhou", e);
        }
    }

    private void responder(PluginCall call, AuthorizationResult res) {
        JSObject o = new JSObject();
        o.put("accessToken", res.getAccessToken());
        JSArray escopos = new JSArray();
        for (String s : res.getGrantedScopes()) escopos.put(s);
        o.put("escopos", escopos);
        call.resolve(o);
    }
}
