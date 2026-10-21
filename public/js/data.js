/* ===================== InnovaAgro-App · datos de interfaz ===================== */

const BRAND = {
  logo: '/assets/logo-640.webp',
  logoSmall: '/assets/logo-256.webp',
  icon: '/assets/icon-180.png'
};

const PHOTOS = {
  hero: '/assets/photos/hero.webp',
  orchard: '/assets/photos/orchard.webp',
  pomelo: '/assets/photos/pomelo.webp',
  pomelo_tree: '/assets/photos/pomelo_tree.webp',
  citricos: '/assets/photos/citricos.webp',
  mandioca: '/assets/photos/mandioca.webp',
  mandioca_plant: '/assets/photos/mandioca_plant.webp',
  almidon: '/assets/photos/almidon.webp',
  batata: '/assets/photos/batata.webp',
  miel: '/assets/photos/miel.webp',
  honeycomb: '/assets/photos/honeycomb.webp',
  beekeeper: '/assets/photos/beekeeper.webp',
  queso: '/assets/photos/queso.webp',
  queso_shop: '/assets/photos/queso_shop.webp',
  dulce: '/assets/photos/dulce.webp',
  hojas: '/assets/photos/hojas.webp',
  market_greens: '/assets/photos/market_greens.webp',
  tomate: '/assets/photos/tomate.webp',
  mango: '/assets/photos/mango.webp',
  banana: '/assets/photos/banana.webp',
  algodon: '/assets/photos/algodon.webp',
  algodon_open: '/assets/photos/algodon_open.webp',
  textil: '/assets/photos/textil.webp',
  pescado: '/assets/photos/pescado.webp',
  pescado_grill: '/assets/photos/pescado_grill.webp',
  farmer: '/assets/photos/farmer.webp',
  farmer_woman: '/assets/photos/farmer_woman.webp',
  farmer_field: '/assets/photos/farmer_field.webp',
  vendor: '/assets/photos/vendor.webp'
};

/* Configuración compartida que llega desde el servidor al iniciar sesión. */
let CATEGORIES = [];
let CITIES = [];
let ROUTES = [];
let PICKUPS = [];

function applyConfig(config) {
  CATEGORIES = Array.isArray(config.categories) ? config.categories : [];
  CITIES = Array.isArray(config.cities) ? config.cities : [];
  ROUTES = Array.isArray(config.routes) ? config.routes : [];
  PICKUPS = Array.isArray(config.pickups) ? config.pickups : [];
}

const CREDITS = [
  { title: 'Cotton boll nearly ready for harvest', creator: 'Michael Bass-Deschenes', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Cotton_boll_nearly_ready_for_harvest.jpg' },
  { title: 'Pomelo fruit', creator: 'Ivar Leidus', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Pomelo_fruit.jpg' },
  { title: 'Pomelo fruit cross section', creator: 'Ivar Leidus', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Pomelo_fruit_cross_section.jpg' },
  { title: 'Orange-Fruit-Pieces', creator: 'Evan-Amos', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Orange-Fruit-Pieces.jpg' },
  { title: 'Freshly harvested cassava roots in a yellow basin', creator: 'Lebu Ayiga', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Freshly_harvested_cassava_roots_in_a_yellow_basin.png' },
  { title: 'Ipomoea batatas - Tubers', creator: "Filo gèn'", license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Ipomoea_batatas_-_Tubers.jpg' },
  { title: 'Dipper stick and honey in a jar', creator: 'Shixart1985', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Dipper_stick_and_honey_in_a_jar.jpg' },
  { title: 'Capped Honey', creator: 'Collins Musonda', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Capped_Honey.jpg' },
  { title: 'Beekeeper holding frame at El Sol Winery', creator: 'Grendelkhan', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Beekeeper_holding_frame_at_El_Sol_Winery.jpg' },
  { title: 'Cowgirl Creamery Point Reyes - Red Hawk cheese', creator: 'Frank Schulenburg', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Cowgirl_Creamery_Point_Reyes_-_Red_Hawk_cheese.jpg' },
  { title: 'Parmesan Cheese Wheel - Whole Foods', creator: 'Paulmcdonald', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Parmesan_Cheese_Wheel_-_Whole_Foods.JPG' },
  { title: 'DulceDeLeche', creator: 'audinou', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:DulceDeLeche.jpg' },
  { title: 'Fields of lettuce, Lower Tenthill, 2022', creator: 'Kerry Raymond', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Fields_of_lettuce,_Lower_Tenthill,_2022.jpg' },
  { title: 'Leafy Vegetables Vending - Howrah', creator: 'Biswarup Ganguly', license: 'CC BY 3.0', source: 'https://commons.wikimedia.org/wiki/File:Leafy_Vegetables_Vending_-_Howrah_2011-01-08_9904.JPG' },
  { title: 'Bright red tomato and cross section02', creator: 'fir0002', license: 'GFDL 1.2', source: 'https://commons.wikimedia.org/wiki/File:Bright_red_tomato_and_cross_section02.jpg' },
  { title: 'Mango and cross section edit', creator: 'Fir0002', license: 'GFDL 1.2', source: 'https://commons.wikimedia.org/wiki/File:Mango_and_cross_section_edit.jpg' },
  { title: 'Banana bunch, stem wrapped', creator: 'Smokefoot', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Banana_bunch,_stem_wrapped.jpg' },
  { title: 'Bangsa Iranun Handwoven Textiles', creator: 'Vince Po', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Bangsa_Iranun_Handwoven_Textiles.jpg' },
  { title: 'Surubí (Pseudoplatystoma corruscans), Itá Ibaté', creator: 'Martín Acosta Albarracín', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Surub%C3%AD_(Pseudoplatystoma_corruscans),_It%C3%A1_Ibat%C3%A9.jpg' },
  { title: 'Pseudoplatystoma corruscans', creator: 'Rocío Esmeralda Pose', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Pseudoplatystoma_corruscans_484849557.jpg' },
  { title: 'Farmer (202116649)', creator: 'Ramkumar Radhakrishnan', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Farmer_(202116649).jpeg' },
  { title: 'Portrait of a young woman wearing a gray balaclava', creator: 'Basile Morin', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Portrait_of_a_young_woman_wearing_a_gray_balaclava.jpg' },
  { title: 'Rice farmer working in his paddy, Bali', creator: 'Uwe Aranas', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Gianyar-Regency_Bali_Indonesia_A-rice-farmer-working-in-his-paddy-01.jpg' },
  { title: 'Sunrise, San Timoteo Canyon', creator: 'inkknife_2000', license: 'CC BY-SA 2.0', source: 'https://commons.wikimedia.org/wiki/File:Sunrise,_San_Timoteo_Canyon_1-20-13a_(8510089345).jpg' }
];
