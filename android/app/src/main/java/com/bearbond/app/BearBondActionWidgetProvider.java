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
    private static final String LAST_DIRECTION_KEY = "last_direction";

    private static final String[] ACTION_IDS = { "kiss", "night", "chicken" };
    private static final int[] BUTTON_IDS = {
        R.id.widget_action_kiss,
        R.id.widget_action_night,
        R.id.widget_action_chicken
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        String lastAction = getLastAction(context);
        String lastDirection = getLastDirection(context);
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId, lastAction, lastDirection);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (!ACTION_WIDGET_SEND.equals(intent.getAction())) return;

        String actionId = intent.getStringExtra(EXTRA_ACTION_ID);
        if (!isKnownShortcut(actionId)) return;

        updateAllWidgets(context, actionId, "sent");
        launchBearBond(context, actionId);
    }

    public static void updateAllWidgets(Context context, String actionId, String direction) {
        if (context == null || actionId == null || actionId.trim().isEmpty()) return;

        String cleanActionId = actionId.trim().toLowerCase();
        String cleanDirection = "received".equals(direction) ? "received" : "sent";

        saveLastAction(context, cleanActionId, cleanDirection);

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName widget = new ComponentName(context, BearBondActionWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(widget);

        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId, cleanActionId, cleanDirection);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId, String lastAction, String lastDirection) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.bearbond_action_widget);

        views.setTextViewText(R.id.widget_sprite, getSpriteText(lastAction));
        views.setTextViewText(R.id.widget_status, getStatusText(lastAction, lastDirection));

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

    private static PendingIntent buildActionPendingIntent(Context context, String actionId, int appWidgetId, int requestOffset) {
        Intent intent = new Intent(context, BearBondActionWidgetProvider.class);
        intent.setAction(ACTION_WIDGET_SEND);
        intent.putExtra(EXTRA_ACTION_ID, actionId);

        int requestCode = (appWidgetId * 20) + requestOffset;
        return PendingIntent.getBroadcast(context, requestCode, intent, pendingIntentFlags());
    }

    private static PendingIntent buildOpenPendingIntent(Context context, String actionId, int appWidgetId, int requestOffset) {
        Intent intent = buildBearBondIntent(context, actionId);

        int requestCode = (appWidgetId * 20) + 10 + requestOffset;
        return PendingIntent.getActivity(context, requestCode, intent, pendingIntentFlags());
    }

    private static void launchBearBond(Context context, String actionId) {
        context.startActivity(buildBearBondIntent(context, actionId));
    }

    private static Intent buildBearBondIntent(Context context, String actionId) {
        Uri widgetUri = Uri.parse("bearbond://widget?action=" + actionId);
        Intent intent = new Intent(Intent.ACTION_VIEW, widgetUri);
        intent.setPackage(context.getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return intent;
    }

    private static String getSpriteText(String actionId) {
        if ("hug".equals(actionId)) return "ʕっ•ᴥ•ʔっ";
        if ("kiss".equals(actionId) || "love".equals(actionId)) return "ʕ ˘ ³˘ʔ♥";
        if ("wave".equals(actionId) || "hello".equals(actionId)) return "ʕ•ᴥ•ʔﾉ";
        if ("night".equals(actionId) || "sleep".equals(actionId)) return "ʕ-ᴥ-ʔ zZ";
        if ("chicken".equals(actionId)) return "ʕ•ᴥ•ʔ🐔";
        if ("honey".equals(actionId)) return "ʕ•ᴥ•ʔ🍯";
        if ("cane".equals(actionId)) return "ʕ•ᴥ•ʔ╯";
        if ("cheeky".equals(actionId)) return "ʕ¬ᴥ¬ʔ";
        return "ʕ•ᴥ•ʔ";
    }

    private static String getStatusText(String actionId, String direction) {
        if (actionId == null || actionId.trim().isEmpty()) return "Waiting for an action";

        String label = getActionLabel(actionId);
        if ("received".equals(direction)) return "Partner sent " + label;
        return "You sent " + label;
    }

    private static String getActionLabel(String actionId) {
        if ("hug".equals(actionId)) return "Hug";
        if ("kiss".equals(actionId) || "love".equals(actionId)) return "Kiss";
        if ("wave".equals(actionId) || "hello".equals(actionId)) return "Wave";
        if ("night".equals(actionId) || "sleep".equals(actionId)) return "Night";
        if ("chicken".equals(actionId)) return "Chicken";
        if ("honey".equals(actionId)) return "Honey";
        if ("cane".equals(actionId)) return "Cane";
        if ("cheeky".equals(actionId)) return "Cheeky";
        return actionId.substring(0, 1).toUpperCase() + actionId.substring(1);
    }

    private static boolean isKnownShortcut(String actionId) {
        for (String knownAction : ACTION_IDS) {
            if (knownAction.equals(actionId)) return true;
        }
        return false;
    }

    private static String getLastAction(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(LAST_ACTION_KEY, "");
    }

    private static String getLastDirection(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(LAST_DIRECTION_KEY, "");
    }

    private static void saveLastAction(Context context, String actionId, String direction) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(LAST_ACTION_KEY, actionId)
            .putString(LAST_DIRECTION_KEY, direction)
            .apply();
    }

    private static int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }
}
