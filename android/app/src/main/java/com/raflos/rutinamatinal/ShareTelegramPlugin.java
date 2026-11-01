package com.raflos.rutinamatinal;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

// Dos modos para mandar la foto de la comida:
//  - share(): ACTION_SEND directo a Telegram (saltea el menu elegir-app), igual
//    hay que elegir chat; sirve para grupos privados no deep-linkeables.
//  - copyAndOpen(): copia la imagen al portapapeles y abre Telegram DIRECTO en un
//    chat deep-linkeable (p.ej. el bot @HermesHeraldoBot via tg://resolve?domain).
//    El usuario solo pega y manda. Ideal para el chat de Hermes.
@CapacitorPlugin(name = "ShareTelegram")
public class ShareTelegramPlugin extends Plugin {

    private static final String[] TG_PACKAGES = {
        "org.telegram.messenger",
        "org.telegram.messenger.web",
        "org.thunderdog.challegram"
    };

    private File resolveFile(String path) {
        String clean = path.startsWith("file://") ? Uri.parse(path).getPath() : path;
        return new File(clean);
    }

    private Uri providerUri(File file) {
        return FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            file
        );
    }

    private String installedTelegram() {
        PackageManager pm = getContext().getPackageManager();
        for (String pkg : TG_PACKAGES) {
            try {
                pm.getPackageInfo(pkg, 0);
                return pkg;
            } catch (PackageManager.NameNotFoundException ignored) { }
        }
        return null;
    }

    @PluginMethod
    public void share(PluginCall call) {
        String path = call.getString("path");
        String text = call.getString("text", "");
        if (path == null) { call.reject("no path"); return; }
        try {
            File file = resolveFile(path);
            if (!file.exists()) { call.reject("file not found"); return; }
            Uri uri = providerUri(file);
            String target = installedTelegram();
            if (target == null) { call.reject("telegram not installed"); return; }

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("image/*");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            if (text != null && !text.isEmpty()) intent.putExtra(Intent.EXTRA_TEXT, text);
            intent.setPackage(target);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "share failed");
        }
    }

    // Copia la imagen al portapapeles y abre el chat deep-linkeable.
    @PluginMethod
    public void copyAndOpen(PluginCall call) {
        String path = call.getString("path");
        String domain = call.getString("domain"); // username del chat (bot/canal)
        if (path == null || domain == null) { call.reject("no path/domain"); return; }
        try {
            File file = resolveFile(path);
            if (!file.exists()) { call.reject("file not found"); return; }
            String target = installedTelegram();
            if (target == null) { call.reject("telegram not installed"); return; }

            Uri uri = providerUri(file);
            // Dar permiso de lectura a Telegram sobre el uri del portapapeles.
            getContext().grantUriPermission(target, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);

            ClipboardManager cb = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = ClipData.newUri(getContext().getContentResolver(), "comida", uri);
            cb.setPrimaryClip(clip);

            Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("tg://resolve?domain=" + domain));
            open.setPackage(target);
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(open);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "copyAndOpen failed");
        }
    }
}
