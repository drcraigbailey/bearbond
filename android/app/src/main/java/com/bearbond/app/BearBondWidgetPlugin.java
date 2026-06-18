package com.bearbond.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BearBondWidget")
public class BearBondWidgetPlugin extends Plugin {
    @PluginMethod
    public void updateAction(PluginCall call) {
        String actionId = call.getString("actionId", "");
        String direction = call.getString("direction", "received");

        BearBondActionWidgetProvider.updateAllWidgets(getContext(), actionId, direction);

        JSObject response = new JSObject();
        response.put("updated", true);
        call.resolve(response);
    }
}
