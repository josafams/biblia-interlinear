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
@CapacitorPlugin(name = "GoogleAccount")
public class GoogleAccountPlugin extends Plugin {
    private static final String DRIVE_APPDATA = "https://www.googleapis.com/auth/drive.appdata";
    private ActivityResultLauncher<IntentSenderRequest> launcher;
    private PluginCall pending;

    @Override
    public void load() {
        launcher = getActivity().getActivityResultRegistry()
            .register("google-account", new ActivityResultContracts.StartIntentSenderForResult(), this::onResult);
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        boolean silent = Boolean.TRUE.equals(call.getBoolean("silent", false));
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Arrays.asList(new Scope("openid"), new Scope("email"), new Scope("profile"), new Scope(DRIVE_APPDATA)))
            .build();
        Identity.getAuthorizationClient(getActivity()).authorize(request)
            .addOnSuccessListener(res -> {
                if (res.hasResolution()) {
                    PendingIntent pi = res.getPendingIntent();
                    if (silent || pi == null) { call.reject("É preciso confirmar no Google.", "interaction-required"); return; }
                    if (pending != null) pending.reject("Outro login começou.", "cancelled");
                    pending = call;
                    launcher.launch(new IntentSenderRequest.Builder(pi.getIntentSender()).build());
                } else {
                    respond(call, res);
                }
            })
            .addOnFailureListener(e -> call.reject(e.getMessage() != null ? e.getMessage() : "Falha no login.", "failed", e));
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        // O token some da memória do app; para revogar de vez: myaccount.google.com › Segurança › Apps com acesso.
        call.resolve();
    }

    private void onResult(ActivityResult r) {
        PluginCall call = pending;
        pending = null;
        if (call == null) return;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null) { call.reject("Login cancelado.", "cancelled"); return; }
        try {
            respond(call, Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(r.getData()));
        } catch (ApiException e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Falha no login.", "failed", e);
        }
    }

    private void respond(PluginCall call, AuthorizationResult res) {
        JSObject o = new JSObject();
        o.put("accessToken", res.getAccessToken());
        JSArray scopes = new JSArray();
        for (String s : res.getGrantedScopes()) scopes.put(s);
        o.put("scopes", scopes);
        call.resolve(o);
    }
}
