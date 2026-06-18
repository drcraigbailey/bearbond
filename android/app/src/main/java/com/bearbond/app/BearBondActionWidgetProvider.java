package com.bearbond.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

public class BearBondActionWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_WIDGET_SEND = "com.bearbond.app.ACTION_WIDGET_SEND";
    private static final String EXTRA_ACTION_ID = "action_id";
    private static final String PREFS_NAME = "bearbond_widget";
    private static final String LAST_ACTION_KEY = "last_action";

    private static final String[] ACTION_IDS = { "hug", "kiss", "wave", "night" };
    private static final int[] BUTTON_IDS = {
        R.id.widget_action_hug,
        R.id.widget_action_kiss,
        R.id.widget_action_wave,
        R.id.widget_action_night
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        String lastAction = getLastAction(context);
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId, lastAction);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (!ACTION_WIDGET_SEND.equals(intent.getAction())) return;

        String actionId = intent.getStringExtra(EXTRA_ACTION_ID);
        if (!isKnownAction(actionId)) return;

        saveLastAction(context, actionId);
        updateAllWidgets(context, actionId);
        launchBearBond(context, actionId);
    }

    private void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId, String lastAction) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.bearbond_action_widget);

        views.setTextViewText(R.id.widget_sprite, getSpriteText(lastAction));
        views.setTextViewText(R.id.widget_status, getStatusText(lastAction));

        views.setOnClickPendingIntent(
            R.id.widget_root,
            buildOpenPendingIntent(context, "open", appWidgetId, 0)
        );

        for (int index = 0; index < ACTION_IDS.length; index++) {
            views.setOnClickPendingIntent(
                BUTTON_IDS[index],
                buildActionPendingIntent(context, ACTION_IDS[index], appWidgetId, index + 1)
            );
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private void updateAllWidgets(Context context, String lastAction) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName widget = new ComponentName(context, BearBondActionWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(widget);

        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId, lastAction);
        }
    }

    private PendingIntent buildActionPendingIntent(Context context, String actionId, int appWidgetId, int requestOffset) {
        Intent intent = new Intent(context, BearBondActionWidgetProvider.class);
        intent.setAction(ACTION_WIDGET_SEND);
        intent.putExtra(EXTRA_ACTION_ID, actionId);

        int requestCode = (appWidgetId * 20) + requestOffset;
        return PendingIntent.getBroadcast(context, requestCode, intent, pendingIntentFlags());
    }

    private PendingIntent buildOpenPendingIntent(Context context, String actionId, int appWidgetId, int requestOffset) {
        Intent intent = buildBearBondIntent(context, actionId);

        int requestCode = (appWidgetId * 20) + 10 + requestOffset;
        return PendingIntent.getActivity(context, requestCode, intent, pendingIntentFlags());
    }

    private void launchBearBond(Context context, String actionId) {
        context.startActivity(buildBearBondIntent(context, actionId));
    }

    private Intent buildBearBondIntent(Context context, String actionId) {
        Uri widgetUri = Uri.parse("bearbond://widget?action=" + actionId);
        Intent intent = new Intent(Intent.ACTION_VIEW, widgetUri);
        intent.setPackage(context.getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return intent;
    }

    private String getSpriteText(String actionId) {
        if ("hug".equals(actionId)) return "ʕっ•ᴥ•ʔっ";
        if ("kiss".equals(actionId)) return "ʕ ˘ ³˘ʔ♥";
        if ("wave".equals(actionId)) return "ʕ•ᴥ•ʔﾉ";
        if ("night".equals(actionId)) return "ʕ-ᴥ-ʔ zZ";
        return "ʕ•ᴥ•ʔ";
    }

    private String getStatusText(String actionId) {
        if ("hug".equals(actionId)) return "Hug sent";
        if ("kiss".equals(actionId)) return "Kiss sent";
        if ("wave".equals(actionId)) return "Wave sent";
        if ("night".equals(actionId)) return "Night sent";
        return "Ready to send";
    }

    private boolean isKnownAction(String actionId) {
        for (String knownAction : ACTION_IDS) {
            if (knownAction.equals(actionId)) return true;
        }
        return false;
    }

    private String getLastAction(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(LAST_ACTION_KEY, "");
    }

    private void saveLastAction(Context context, String actionId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(LAST_ACTION_KEY, actionId).apply();
    }

    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }
}
