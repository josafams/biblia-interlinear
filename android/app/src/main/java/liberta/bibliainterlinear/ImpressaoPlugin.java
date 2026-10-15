package liberta.bibliainterlinear;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Imprime um HTML pelo serviço de impressão do Android, que também oferece "Salvar como PDF".
 * Usado para o caderno de anotações (web/anotacoes.js), porque window.print() não funciona dentro do app.
 */
@CapacitorPlugin(name = "Impressao")
public class ImpressaoPlugin extends Plugin {
    private WebView webView; // mantém a referência até a impressão começar

    @PluginMethod
    public void printHtml(PluginCall call) {
        final String html = call.getString("html");
        final String titulo = call.getString("titulo", "Caderno de estudo");
        if (html == null) {
            call.reject("html vazio");
            return;
        }
        getActivity().runOnUiThread(() -> {
            webView = new WebView(getContext());
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    PrintManager pm = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                    PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(titulo);
                    PrintAttributes attrs = new PrintAttributes.Builder()
                            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                            .build();
                    pm.print(titulo, adapter, attrs);
                    call.resolve();
                }
            });
            webView.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
        });
    }
}
