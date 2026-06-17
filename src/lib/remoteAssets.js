import { supabase } from './supabaseClient';
import { applyRemoteScenes } from '../data/scenes';

const cleanId = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '-');

const getPublicStorageUrl = (bucket, path) => {
  if (!bucket || !path) return '';

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || '';
};

const getAssetUrl = ({ url, bucket, path }) => {
  if (url) return url;
  return getPublicStorageUrl(bucket, path);
};

export const loadRemoteScenes = async () => {
  const { data, error } = await supabase
    .from('custom_scenes')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.warn('Could not load custom scenes:', error.message);
    applyRemoteScenes([]);
    return [];
  }

  const scenes = (data || [])
    .map((scene) => {
      const id = cleanId(scene.id || scene.slug || scene.name);
      const image = getAssetUrl({
        url: scene.image_url,
        bucket: scene.storage_bucket,
        path: scene.storage_path,
      });

      if (!id || !scene.name || !image) return null;

      return {
        id,
        name: scene.name,
        image,
        isRemote: true,
      };
    })
    .filter(Boolean);

  applyRemoteScenes(scenes);
  return scenes;
};

export const loadRemoteAvatars = async () => {
  const { data, error } = await supabase
    .from('custom_avatars')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.warn('Could not load custom avatars:', error.message);
    return [];
  }

  return (data || [])
    .map((avatar) => {
      const id = cleanId(avatar.id || avatar.slug || avatar.name);
      if (!id || !avatar.name) return null;

      const bucket = avatar.storage_bucket;
      const prefix = avatar.storage_prefix ? String(avatar.storage_prefix).replace(/\/$/, '') : '';
      const spriteUrl = (specificUrl, specificPath, fileName) => getAssetUrl({
        url: specificUrl,
        bucket,
        path: specificPath || (prefix ? `${prefix}/${fileName}` : ''),
      });

      const idleUrl = spriteUrl(avatar.idle_url || avatar.preview_url, avatar.idle_path || avatar.preview_path, 'main.png');

      return {
        id,
        name: avatar.name,
        preview_url: avatar.preview_url || idleUrl,
        idle_url: idleUrl,
        wave_url: spriteUrl(avatar.wave_url, avatar.wave_path, 'wave.png'),
        love_url: spriteUrl(avatar.love_url || avatar.kiss_url, avatar.love_path || avatar.kiss_path, 'kiss.png'),
        hug_url: spriteUrl(avatar.hug_url, avatar.hug_path, 'hug.png'),
        honey_url: spriteUrl(avatar.honey_url, avatar.honey_path, 'honey.png'),
        sleep_url: spriteUrl(avatar.sleep_url || avatar.night_url, avatar.sleep_path || avatar.night_path, 'night.png'),
        dance_url: spriteUrl(avatar.dance_url || avatar.cheeky_url, avatar.dance_path || avatar.cheeky_path, 'cheeky.png'),
        celebrate_url: spriteUrl(avatar.celebrate_url || avatar.cane_url, avatar.celebrate_path || avatar.cane_path, 'cane.png'),
        isRemote: true,
      };
    })
    .filter(Boolean);
};
