// Import your uploaded assets
import bgHome from '../assets/scenes/backdrop-home.png';
import bgUni from '../assets/scenes/backdrop-uni.png';
import bgHill from '../assets/scenes/backdrop-hill.png';
import bgWork from '../assets/scenes/backdrop-work.png';
import bgPub from '../assets/scenes/backdrop-pub.png';
import bgShop from '../assets/scenes/backdrop-shop.svg';
import bgVets from '../assets/scenes/backdrop-vets.svg';

// The "export const" is required here to match the import { SCENES } in your other files.
export const SCENES = {
  home: { id: 'home', name: 'Cosy Cabin', image: bgHome },
  hill: { id: 'hill', name: 'Sunny Hills', image: bgHill },
  uni: { id: 'uni', name: 'University', image: bgUni },
  work: { id: 'work', name: 'Cafe / Work', image: bgWork },
  shop: { id: 'shop', name: 'Shop', image: bgShop },
  vets: { id: 'vets', name: 'Vets', image: bgVets },
  pub: { id: 'pub', name: 'The Golden Tankard', image: bgPub },
};
