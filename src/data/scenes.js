// Load all scene backdrop assets that exist in the repo.
// PNGs are preferred, with SVG fallbacks for shop/vets so the app still builds if the PNGs are missing locally.
const sceneAssets = import.meta.glob([
  '../assets/scenes/backdrop-*.png',
  '../assets/scenes/backdrop-*.svg',
], {
  eager: true,
  query: '?url',
  import: 'default',
});

const getSceneImage = (preferredFile, fallbackFile = preferredFile) => {
  return sceneAssets[`../assets/scenes/${preferredFile}`] || sceneAssets[`../assets/scenes/${fallbackFile}`];
};

// The "export const" is required here to match the import { SCENES } in your other files.
export const SCENES = {
  home: { id: 'home', name: 'Cosy Cabin', image: getSceneImage('backdrop-home.png') },
  hill: { id: 'hill', name: 'Sunny Hills', image: getSceneImage('backdrop-hill.png') },
  uni: { id: 'uni', name: 'University', image: getSceneImage('backdrop-uni.png') },
  work: { id: 'work', name: 'Cafe / Work', image: getSceneImage('backdrop-work.png') },
  shop: { id: 'shop', name: 'Shop', image: getSceneImage('backdrop-shop.png', 'backdrop-shop.svg') },
  vets: { id: 'vets', name: 'Vets', image: getSceneImage('backdrop-vets.png', 'backdrop-vets.svg') },
  pub: { id: 'pub', name: 'The Golden Tankard', image: getSceneImage('backdrop-pub.png') },
  hols: { id: 'hols', name: 'Holiday Room', image: getSceneImage('backdrop-hols.png') },
  bed: { id: 'bed', name: 'Night Bedroom', image: getSceneImage('backdrop-bed.png') },
  town: { id: 'town', name: 'Rainy Town', image: getSceneImage('backdrop-town.png') },
  mway: { id: 'mway', name: 'Motorway', image: getSceneImage('backdrop-mway.png') },
};
