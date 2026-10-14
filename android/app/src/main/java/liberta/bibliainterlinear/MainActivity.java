package liberta.bibliainterlinear;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin próprio do app: impressão e PDF do caderno de anotações
        registerPlugin(ImpressaoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
