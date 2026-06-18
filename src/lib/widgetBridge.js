import * as CapacitorCore from '@capacitor/core';

const NativeWidget = CapacitorCore.registerPlugin('BearBondWidget');

export const updateBearBondWidget = async (actionId, { direction = 'received' } = {}) => {
  if (!actionId || !CapacitorCore.Capacitor.isNativePlatform()) return false;

  try {
    await NativeWidget.updateAction({ actionId, direction });
    return true;
  } catch (error) {
    console.warn('Could not update BearBond widget:', error);
    return false;
  }
};
