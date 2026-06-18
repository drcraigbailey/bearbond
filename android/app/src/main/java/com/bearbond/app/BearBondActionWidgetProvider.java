package com.bearbond.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

public class BearBondActionWidgetProvider extends AppWidgetProvider {
    private static final String[] ACTION_IDS = { "hug", "kiss", "wave", "night" };
    private static final int[] BUTTON_IDS = {
        R.id.widget_action_hug,
        R.id.widget_action_kiss,
        R.id.widget_action_wave,
        R.id.widget_action_night
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.bearbond_action_widget);

            views.setOnClickPendingIntent(
                R.id.widget_root,
                buildOpenPendingIntent(context, "open", appWidgetId, 0)
            );

            for (int index = 0; index < ACTION_IDS.length; index++) {
                views.setOnClickPendingIntent(
                    BUTTON_IDS[index],
                    buildOpenPendingIntent(context, ACTION_IDS[index], appWidgetId, index + 1)
                );
            }

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    private PendingIntent buildOpenPendingIntent(Context context, String actionId, int appWidgetId, int requestOffset) {
        Uri widgetUri = Uri.parse("bearbond://widget?action=" + actionId);
        Intent intent = new Intent(Intent.ACTION_VIEW, widgetUri);
        intent.setPackage(context.getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int requestCode = (appWidgetId * 10) + requestOffset;
        return PendingIntent.getActivity(context, requestCode, intent, pendingIntentFlags());
    }

    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }
}
