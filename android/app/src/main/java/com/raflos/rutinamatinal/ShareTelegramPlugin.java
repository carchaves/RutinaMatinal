package com.raflos.rutinamatinal;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

// Comparte una imagen directo a Telegram (ACTION_SEND con setPackage), para
// saltear el menu "elegir app" de Android. Telegram igual pide a que chat
// mandarla (los grupos privados no son deep-linkeables), pero la foto ya va
// adjunta. Si Telegram no esta instalado, rechaza y el JS cae al Share normal.
@CapacitorPlugin(name = "ShareTelegram")
public class ShareTelegramPlugin extends Plugin {

    private static final String[] TG_PACKAGES = {
        "org.telegram.messenger",       // Telegram (Play / directo)
        "org.telegram.messenger.web",   // variante Play
        "org.thunderdog.challegram"     // Telegram X
    };

    @PluginMethod
    public void share(PluginCall call) {
        String path = call.getString("path");
        String text = call.getString("text", "");
        if (path == null) {
            call.reject("no path");
            return;
        }
        try {
            String clean = path.startsWith("file://") ? Uri.parse(path).getPath() : path;
            File file = new File(clean);
            if (!file.exists()) {
                call.reject("file not found");
                return;
            }
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            PackageManager pm = getContext().getPackageManager();
            String target = null;
            for (String pkg : TG_PACKAGES) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    target = pkg;
                    break;
                } catch (PackageManager.NameNotFoundException ignored) { }
            }
            if (target == null) {
                call.reject("telegram not installed");
                return;
            }

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("image/*");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            if (text != null && !text.isEmpty()) {
                intent.putExtra(Intent.EXTRA_TEXT, text);
            }
            intent.setPackage(target);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "share failed");
        }
    }
}
