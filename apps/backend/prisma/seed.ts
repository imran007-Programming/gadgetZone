/**
 * Gadget-store seed script.
 *
 * Wipes ALL existing data (orders, cart items, products, categories, users)
 * and reseeds a fresh gadget catalog: 1 admin + 5 customers, 7 gadget
 * categories, exactly 100 gadget products.
 *
 * Wipe + recreate is naturally idempotent: every run ends with the same data.
 *
 * Run with: npx prisma db seed
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/* Verified real gadget product photos (100). */
const PRODUCT_IMAGES: string[] = [
  'https://m.media-amazon.com/images/I/81D8qvXkI6L._SY500_.jpg',
  'https://m.media-amazon.com/images/I/51X0KwnaAPL.jpg',
  'https://cdn.shopify.com/s/files/1/0551/9992/4395/files/Keychron-K14-Pro-QMK-Wireless-Mechanical-Keyboard-Camera-Shot-Photo-6.jpg?v=1687748346',
  'https://cdn.shopify.com/s/files/1/0568/8514/9779/files/Keychron-K12-Pro-QMK-Wireless-Mechanical-Keyboard-8.jpg?v=1685004291',
  'https://cdn.shopify.com/s/files/1/0568/8514/9779/files/Keychron-K12-Pro-QMK-Wireless-Mechanical-Keyboard-2.jpg?v=1685006041',
  'https://cdn.shopify.com/s/files/1/0059/0630/1017/files/K2_Max3.jpg?v=1721722002',
  'https://cdn.shopify.com/s/files/1/0549/6284/7873/files/Q3-max-page3_7a0e9bf3-dd18-43a7-bcff-b03e91184bd5_1200x.jpg?v=1705050002',
  'https://cdn.shopify.com/s/files/1/0059/0630/1017/files/Keychron-K2-Version-3-QMK-Aluminum-Frame-Wireless-Keyboard-ISO-1.jpg?v=1748487902',
  'https://m.media-amazon.com/images/S/aplus-media/sc/e2f47e35-a5fd-4d89-acc9-3855d79118fd.__CR0,0,1464,600_PT0_SX1464_V1___.jpg',
  'https://images-na.ssl-images-amazon.com/images/I/71-hmb+dXbL._AC_SL500_.jpg',
  'https://m.media-amazon.com/images/I/51s-recKAVL.jpg',
  'https://cdn.shopify.com/s/files/1/0694/0242/7619/articles/USB-C-Charger-Cables_5478dc97-c1e8-48e3-9d01-a5dfbb8a49fc.jpg?v=1741771596',
  'https://cdn.shopify.com/s/files/1/0504/7094/4954/files/arlo-pro-5s-2k.jpg?v=1714362365',
  'https://m.media-amazon.com/images/I/51PGonsQWlL._AC_SL1500_.jpg',
  'https://mir-s3-cdn-cf.behance.net/project_modules/1400/2dbeaa194366591.65fae263b9f12.png',
  'https://mir-s3-cdn-cf.behance.net/project_modules/1400/85c7f0178829153.64eefaa2b12e7.jpg',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1589003077984-894e133dabab?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=600&q=80&auto=format&fit=crop',
  'https://easymedia.online/uploads/products/14986591252555-Bluetooth-Speaker-18.jpg',
  'https://cms.cloudinary.vpsvc.com/image/fetch/c_scale,dpr_1.0,f_auto,q_auto:best,w_816/https%3A%2F%2Frendering.documents.cimpress.io%2Fv1%2Fvistaprint-prod%2Fpreview%3Fwidth%3D1500%26scene%3Dhttps%253A%252F%252Fcdn.scenes.documents.cimpress.io%252Fv3%252Ftransformations%252Frecolor%253FsceneUri%253Dhttps%25253A%25252F%25252Fcdn.scenes.documents.cimpress.io%25252Fv3%25252Fassets%25252F86982b5f-c7d8-4117-a6a3-db734f456685%25252Frevisions%25252F9a8a36d1-f890-4a02-afd3-d88fcfb8da4f%25252Fcontent%2526r%253D192%2526g%253D192%2526b%253D192',
  'https://manager-test.otcommerce.com/plugin/request/ImagePro?i=aHR0cHM6Ly9jYnUwMS5hbGljZG4uY29tL2ltZy9pYmFuay9PMUNOMDFkWU41VU4yNXJFa21qdHpTZF8hITIyMTc5MDUzMzc1NzktMC1jaWIuNjAweDYwMC5qcGc%3D',
  'https://down-br.img.susercontent.com/file/br-11134201-22120-tq6xr5wtcukv44',
  'https://assetly.ordermygear.com/assets/8cb333b94afe8e327dfe9e252c0de5d2ff6fe65a',
  'https://cbu01.alicdn.com/img/ibank/O1CN01ME37gd21MJTh9bqKw_!!4092526970-0-cib.jpg?__r__=1700461373451',
  'https://promocrunch.com/wp-content/uploads/2022/01/stock-power-bank-7b.jpg',
  'https://media.base44.com/images/public/6a8a354090f8b6f56455a5ad/381d70a38_generated_40d7591a.png',
  'https://jlcprinting.com/_next/image?url=https%3A%2F%2Fjtsp0wxerbohn7ch.public.blob.vercel-storage.com%2Fpromo%2Fpcna%2Fmophie-power-boost-2-0-20-000-mah-power-bank%2Fblack-1.jpg&w=1080&q=75',
  'https://img.portable-powerbanks.com/photo/portable-powerbanks/editor/20260115140244_64638.png',
  'https://jlcprinting.com/_next/image?url=https%3A%2F%2Fjtsp0wxerbohn7ch.public.blob.vercel-storage.com%2Fpromo%2Fpcna%2Fmophie-power-boost-2-0-10-000-mah-power-bank%2Fblack-1.jpg&w=1200&q=75',
  'https://www.cellhelmet.com/cdn/shop/files/5K-mAh-Power-Bank---Dual-Type-A-Ports-and-Single-Type-C-cellhelmet-1686347722.png?v=1747688153&width=400',
  'https://img.portable-powerbanks.com/photo/portable-powerbanks/editor/20260113111610_42262.jpg',
  'https://static.vecteezy.com/system/resources/thumbnails/072/189/896/small/a-small-portable-battery-is-next-to-a-coin-photo.jpg',
  'https://www.dronex.co.il/wp-content/uploads/2025/07/drone-with-camera-white-background-1.webp',
  'https://img.myloview.se/canvastavlor/modern-drone-with-camera-isolated-on-white-700-211513420.jpg',
  'https://www.reddotphoto.com.sg/cdn/shop/files/02a801ee709a7eb0795d5a9d77411ee7_origin.jpg?v=1761036149&width=1080',
  'https://www.robot-advance.com/ori-drone-dji-mavic-2-pro-eu-2619.jpg',
  'https://images.int.dreamhosters.ai/ai/2951506/product_gallery/bwine-f7-drone-professional-aerial-photography-white-background',
  'https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI2LTAzL3NyLWltYWdlLTI0MDMyMDI2LWFtMTEtcy0wNTBfMS5qcGc.jpg',
  'https://realphone.com.ua/i/16686/d1-depositphotos-bgremover_500x.png',
  'https://slimages.macysassets.com/is/image/MCY/products/8/optimized/34697548_fpx.tif?qlt=80,0&resMode=sharp2&op_usm=1.75,0.3,2,0&fmt=webp&wid=342&hei=417',
  'https://img-edg.joomcdn.net/b2a56d74cf7089b84e640980f2fa93bc3f9499eb_original.jpeg',
  'https://www.rockitx.com/templates/img/ec-5.png',
  'https://www.pngfind.com/pngs/b/378-3785228_virb-ultra-30-can-your-action-camera-do.png',
  'https://static.vecteezy.com/system/resources/thumbnails/069/896/944/small/waterproof-action-camera-with-water-droplets-on-housing-free-photo.jpg',
  'https://www.webbestore.com/cdn/shop/files/qiwa-4k-sports-action-camera-with-optical-16mp-high-resolution-with-wi-fi-4k-ultra-hd-video-recording-with-170-degree-wide-angle-waterproof-underwater-camera-product-images-orvatg8iup.webp?v=1775585164&width=832',
  'https://cdn.iconly.ai/iconly/public/icons/webp/action-camera-f48b1c56-3650-4a36-8614-8a2914d9be37.webp',
  'https://www.static-src.com/siva/asset/10_2025/action-cam-electronics.png',
  'https://dji-official-fe.djicdn.com/dps/c3eb3d0509003f1ca19055257cdeb541.jpg',
  'https://theawesomer.com/photos/2025/03/keychron_k2_max_keyboard_t.jpg',
  'https://cdn.gaterongpro.com/cdn/10861/2025/10/30/Keychron-K12-Pro-QMKVIA-Wireless-Mechanical-Keyboard-Custom-Programmable-Macro-with-HotSwappable-Keychron-K-Pro-Brown-Switch-60-Compact-Layout-RGB-Bac-8246016-2225.jpg',
  'https://cdn.gaterongpro.com/cdn/10861/2025/10/30/keychron-K13-Pro-UltraSlim-QMKVIA-Wireless-Mechanical-Keyboard-TKL-Layout-with-Numpad-Custom-Programmable-RGB-with-Hotswappable-LowProfile-Gateron-Bro-1381905-4253.jpg',
  'https://meletrix.com/cdn/shop/files/1_a5b8f669-d458-4ebf-a5c8-c35437947212_1024x1024.jpg',
  'https://img.chinagamingheadsets.com/photo/chinagamingheadsets/editor/20240925165540_93740.png',
  'https://i.postimg.cc/6WkMdrff/8.png',
  'https://www.dropified.com/wp-content/uploads/2026/02/professional-product-photography-of-gaming-headset-1770139003.png',
  'https://u-mercari-images.mercdn.net/photos/m50483727792_1.jpg?width=1280&quality=75&_=1627839768',
  'https://m.artshow-computer.com/test/artshow-computer.com/photo/pl201760223-remark.jpg',
  'https://www.honcam.com/Data/honcam/upload/image/20240319/3-29.webp',
  'https://img-cdn.publive.online/fit-in/1280x960/filters:format(webp)/pcq/media/media_files/2026/08/06/headphone-2026-08-06-14-53-13.png',
  'https://lh3.googleusercontent.com/YFachn5_d97XB_rD4i9K_Zp7XAGIeiE54Kl14nieXq9LMq31KhP7sMRjnkIvBwUR38CHy260jIeNbMWAOkGiDQ5zOuYcU6wzlfN9GfnT7Ov2Cw',
  'https://wfvxoarzujpdewrzcobs.supabase.co/storage/v1/object/public/generated-images/user_2t0saV2aNwVcvBqfvio9JVCwd27/1743827686196-7mmcmi.png',
  'https://digitalassets.sallinggroup.com/image/upload/e_trim:2,e_sharpen:80,q_auto,f_auto,b_white,w_500,e_grayscale/t_DigitalAiLogo/ef32216a10c67ea295be815cab2b3465',
  'https://nxdigitalagency.com/wp-content/uploads/2023/08/fotograf-predmetnaya-fotosessiya.jpg',
  'https://cdn.testsieger.de/produkt/eyJrZXkiOiJ2LmVrL3Byb2R1Y3QvZjUvZjVhYTEwMjctMzFjNS01YWJkLTkzZGItZjczZjE1N2FhYTJjLmpwZyIsImVkaXRzIjp7InRyaW0iOjEwLCJyZXNpemUiOnsid2lkdGgiOjM2OCwiaGVpZ2h0IjozNjgsImZpdCI6ImNvbnRhaW4iLCJiYWNrZ3JvdW5kIjp7InIiOjI1NSwiZyI6MjU1LCJiIjoyNTUsImFscGhhIjoxfX0sIndlYnAiOnsicXVhbGl0eSI6ODZ9fX0=',
  'https://freelance.ru/download/5299899/pic2696345.jpg',
  'https://i.ebayimg.com/images/g/tkgAAOSwqPxjLm16/s-l1600.jpg',
  'https://i.ebayimg.com/images/g/olUAAOSwg2FkMM8T/s-l600.webp',
  'https://chinsey.com/plugin/request/ImagePro?i=aHR0cHM6Ly9jYnUwMS5hbGljZG4uY29tL2ltZy9pYmFuay8yMTMxMzQxODI0Nl8xNDIxODc1MDE5LjYwMHg2MDAuanBn',
  'https://i.ebayimg.com/images/g/wlUAAOSwnoJi~1dP/s-l1600.jpg',
  'https://technamart.co.uk/cdn/shop/products/PLUG-USBC-CBL1_9b342325-303b-4e0e-8a2e-0085ff2a3ee7.png?v=1689169987&width=690',
  'https://ae01.alicdn.com/kf/HTB1xK8iXhn1gK0jSZKPq6xvUXXap.jpg',
  'https://bsg-i.nbxc.com/product/0a/dd/20/1552c5e736bf7716033ba94cb4.jpg@4e_360w_360h.src',
  'https://reviewzone.com.br/wp-content/uploads/2025/08/Fx__High-resolution-product-photography-of-Samsung-Galaxy-Fit3-with-attention-to-every-detail__2.webp',
  'https://lovers8bp.com/wp-content/uploads/2026/06/Modern_clean_e-commerce_product_photography_202606011422-1024x572.avif',
  'https://media-mbst-pub-ue1.s3.amazonaws.com/creatr-uploaded-images/2020-08/154754b1-e78e-11ea-9ad3-1e46eb01c148',
  'https://reviewzone.com.br/wp-content/uploads/2025/08/Fx__Clean-product-photography-of-Samsung-Galaxy-Fit3-with-soft-box-lighting-and-no-harsh-shadows__1.webp',
  'https://cdn.preisvergleich.check24.de/produkt/eyJrZXkiOiJ2LmVrLzBmLzBmNjQzZGFmLTU0NzctNTEyZC1iMTZlLWQ4N2NhMjQ0NjdjNi5qcGVnIiwiZWRpdHMiOnsidHJpbSI6MTAsInJlc2l6ZSI6eyJ3aWR0aCI6NzM2LCJoZWlnaHQiOjczNiwiZml0IjoiY29udGFpbiIsImJhY2tncm91bmQiOnsiciI6MjU1LCJnIjoyNTUsImIiOjI1NSwiYWxwaGEiOjF9fSwid2VicCI6eyJxdWFsaXR5Ijo4Mn19fQ==',
  'https://cdn.creativemarketingincentives.biz/cmi_front/assets/images/howitworks/smart-product.webp',
  'https://reviewzone.com.br/wp-content/uploads/2025/08/Fx__Artistic-product-photography-of-Samsung-Galaxy-Fit3-with-geometric-shapes-and-modern-composition__1.webp',
  'https://cdn.myportfolio.com/632a6d8c-e00c-433b-a9a2-fd41c826800c/8f1f7628-32c6-46f5-85f7-d7be71b6685b_car_1x1.jpg?h=22f12203cfc7511e7d6bfa08ea7158bd',
  'https://images.squarespace-cdn.com/content/v1/5a1fac7e914e6b30d737146f/1594449013513-TI6LDWI4DXATWR6TOVEB/228A3945.jpg?format=500w',
  'https://smarthomecontroller.app/assets/smart-camera-BYKc8DL9.png',
];

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random generator (mulberry32, fixed seed).     */
/* No Math.random() anywhere, so every run produces identical data.    */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261015);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const toDecimal = (n: number) => new Prisma.Decimal(n.toFixed(2));

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */
const ADMIN = {
  email: 'admin@example.com',
  password: 'Admin@123',
  name: 'Store Admin',
  role: 'ADMIN' as const,
};

const CUSTOMERS = [
  { email: 'aarav.sharma@example.com', name: 'Aarav Sharma' },
  { email: 'priya.patel@example.com', name: 'Priya Patel' },
  { email: 'rohan.gupta@example.com', name: 'Rohan Gupta' },
  { email: 'ananya.singh@example.com', name: 'Ananya Singh' },
  { email: 'vikram.mehta@example.com', name: 'Vikram Mehta' },
];
const CUSTOMER_PASSWORD = 'Customer@123';

/* ------------------------------------------------------------------ */
/* Gadget categories (7)                                               */
/* ------------------------------------------------------------------ */
const CATEGORIES = [
  {
    slug: 'audio',
    name: 'Audio',
    description: 'Earbuds, headphones, speakers and studio audio gear.',
  },
  {
    slug: 'wearables',
    name: 'Wearables',
    description: 'Smartwatches, fitness trackers and smart rings.',
  },
  {
    slug: 'smart-home',
    name: 'Smart Home',
    description: 'Smart hubs, lighting, security and home automation.',
  },
  {
    slug: 'mobile-accessories',
    name: 'Mobile Accessories',
    description: 'Power banks, chargers, cables, cases and phone gear.',
  },
  {
    slug: 'computing',
    name: 'Computing',
    description: 'Keyboards, mice, docks, webcams and desk setup essentials.',
  },
  {
    slug: 'cameras-drones',
    name: 'Cameras & Drones',
    description: 'Action cameras, camera drones, gimbals and lenses.',
  },
  {
    slug: 'gaming',
    name: 'Gaming',
    description: 'Controllers, gaming headsets, VR and streaming gear.',
  },
];

/* ------------------------------------------------------------------ */
/* Products — exactly 100 across the 7 categories.                     */
/* Each entry: [name, price]. Descriptions are built deterministically. */
/* ------------------------------------------------------------------ */
type ProductDef = { name: string; price: number };

const PRODUCT_DEFS: Record<string, ProductDef[]> = {
  audio: [
    { name: 'NovaBuds Pro Wireless Earbuds', price: 79.99 },
    { name: 'BoomBox Mini Bluetooth Speaker', price: 49.99 },
    { name: 'StudioMax Over-Ear Headphones', price: 149.99 },
    { name: 'AeroPods Lite True Wireless', price: 39.99 },
    { name: 'ThunderBass Party Speaker', price: 129.99 },
    { name: 'ClearCall USB Headset', price: 59.99 },
    { name: 'SoundBar Slim 2.1', price: 119.99 },
    { name: 'RetroTurn Vinyl Bluetooth Speaker', price: 89.99 },
    { name: 'BassPod Neckband Earphones', price: 29.99 },
    { name: 'HiFi DAC Portable Amplifier', price: 99.99 },
    { name: 'SleepBuds Noise Masking Earbuds', price: 69.99 },
    { name: 'Karaoke Mic Pro Wireless', price: 54.99 },
    { name: 'SoundCube Smart Speaker', price: 79.99 },
    { name: 'StudioMic USB Condenser', price: 109.99 },
    { name: 'AirDrum Wireless Headphones', price: 44.99 },
  ],
  wearables: [
    { name: 'AeroWatch GT Smartwatch', price: 199.99 },
    { name: 'PulseBand 6 Fitness Tracker', price: 59.99 },
    { name: 'OrbitWatch Kids GPS', price: 89.99 },
    { name: 'HaloRing Smart Ring', price: 149.99 },
    { name: 'TitanWatch Ultra Rugged', price: 349.99 },
    { name: 'FitClip Activity Tracker', price: 34.99 },
    { name: 'AeroWatch SE Sport', price: 129.99 },
    { name: 'SleepSense Tracker Band', price: 79.99 },
    { name: 'PulseWatch ECG Monitor', price: 249.99 },
    { name: 'TagMate Bluetooth Tracker', price: 24.99 },
    { name: 'LumaBand LED Fitness', price: 44.99 },
    { name: 'AeroWatch Classic Leather', price: 179.99 },
    { name: 'StridePod Running Sensor', price: 69.99 },
    { name: 'VitalPatch Health Monitor', price: 119.99 },
  ],
  'smart-home': [
    { name: 'EchoNest Smart Hub', price: 99.99 },
    { name: 'LumaBulb RGB Smart Bulbs 4-Pack', price: 39.99 },
    { name: 'SecureCam 360 Indoor', price: 69.99 },
    { name: 'ThermoSmart WiFi Thermostat', price: 129.99 },
    { name: 'DoorBell Pro Video', price: 149.99 },
    { name: 'PlugMini Smart Plugs 4-Pack', price: 29.99 },
    { name: 'RoboVac S9 LiDAR', price: 299.99 },
    { name: 'AirPure HEPA Purifier', price: 159.99 },
    { name: 'LumaStrip LED 5m', price: 24.99 },
    { name: 'LockPro Fingerprint Deadbolt', price: 189.99 },
    { name: 'SenseHub Motion Sensors 3-Pack', price: 49.99 },
    { name: 'CurtainBot Auto Opener', price: 79.99 },
    { name: 'GardenSense Soil Monitor', price: 34.99 },
    { name: 'ChimeBox Smart Doorbell', price: 59.99 },
  ],
  'mobile-accessories': [
    { name: 'VoltCore 20000mAh Power Bank', price: 39.99 },
    { name: 'MagCharge 15W Wireless Pad', price: 29.99 },
    { name: 'TurboCable 100W USB-C 2m', price: 14.99 },
    { name: 'GripCase Armor Pro', price: 24.99 },
    { name: 'LensKit Pro Mobile', price: 49.99 },
    { name: 'StandFold Aluminum Dock', price: 19.99 },
    { name: 'VoltCore Slim 10000mAh', price: 27.99 },
    { name: 'CarMount MagSafe Pro', price: 34.99 },
    { name: 'TurboBrick 65W GaN Charger', price: 44.99 },
    { name: 'CableKit Braided 3-Pack', price: 18.99 },
    { name: 'SelfieStick Pro Tripod', price: 32.99 },
    { name: 'MagWallet Leather Card', price: 29.99 },
    { name: 'ScreenGuard Ceramic 2-Pack', price: 12.99 },
    { name: 'VoltCore 30000mAh PD', price: 54.99 },
    { name: 'BudCase Wireless Earbud Case', price: 16.99 },
    { name: 'RingLight Mini Vlog', price: 22.99 },
  ],
  computing: [
    { name: 'KeyForge Mech Keyboard', price: 119.99 },
    { name: 'SwiftMouse Pro Wireless', price: 69.99 },
    { name: 'UltraDock 11-in-1 USB-C', price: 149.99 },
    { name: 'PixelPad Drawing Tablet', price: 199.99 },
    { name: 'VoltHub 7-Port USB Hub', price: 39.99 },
    { name: 'CoolPad Laptop Stand', price: 34.99 },
    { name: 'StreamCam 4K Webcam', price: 129.99 },
    { name: 'KeyForge Mini 65 Percent', price: 89.99 },
    { name: 'ErgoTrack Trackball', price: 79.99 },
    { name: 'SSDVault 1TB Portable', price: 109.99 },
    { name: 'MonitorBar Screen Light', price: 49.99 },
    { name: 'DeskMat XXL RGB', price: 29.99 },
    { name: 'CableDock Organizer Kit', price: 21.99 },
    { name: 'PowerStrip Smart 6-Outlet', price: 44.99 },
  ],
  'cameras-drones': [
    { name: 'SkyHawk 4K Drone', price: 299.99 },
    { name: 'ActionCam X5 Waterproof', price: 199.99 },
    { name: 'SkyHawk Mini SE', price: 149.99 },
    { name: 'GimbalPro 3-Axis', price: 129.99 },
    { name: 'LensPro Wide Angle', price: 89.99 },
    { name: 'SkyHawk FPV Racer', price: 399.99 },
    { name: 'TripodMax Carbon 2m', price: 119.99 },
    { name: 'ActionCam Float Grip', price: 24.99 },
    { name: 'DroneBag Hard Case', price: 59.99 },
    { name: 'SkyHawk Battery Plus', price: 69.99 },
    { name: 'CamLight LED Panel', price: 74.99 },
    { name: 'LensPro Macro Kit', price: 54.99 },
    { name: 'SkyHawk Prop Guard Set', price: 19.99 },
  ],
  gaming: [
    { name: 'StrikePad Pro Controller', price: 69.99 },
    { name: 'VoltHeadset 7.1 Gaming', price: 99.99 },
    { name: 'ArcadeStick Retro Pro', price: 129.99 },
    { name: 'StrikePad Elite Wireless', price: 149.99 },
    { name: 'GameDock Switch Station', price: 59.99 },
    { name: 'VoltChair RGB Gaming', price: 249.99 },
    { name: 'KeyForge Game Keypad', price: 79.99 },
    { name: 'StreamDeck Mini 6-Key', price: 89.99 },
    { name: 'VRSense Headset', price: 349.99 },
    { name: 'StrikeMouse 26K DPI', price: 59.99 },
    { name: 'GameStream Capture 4K', price: 139.99 },
    { name: 'VoltPad Cooling Stand', price: 39.99 },
    { name: 'ArcadeMini Handheld', price: 119.99 },
    { name: 'ChatMix Gaming Mixer', price: 109.99 },
  ],
};

const DESC_TEMPLATES: Record<string, [string, string]> = {
  audio: [
    'The {name} delivers rich, detailed sound for music, calls and gaming.',
    'Premium drivers, long battery life and a comfortable all-day fit.',
  ],
  wearables: [
    'The {name} keeps your health and notifications on your wrist.',
    'Accurate sensors, bright display and multi-day battery life.',
  ],
  'smart-home': [
    'The {name} makes your home smarter, safer and more convenient.',
    'Easy app setup with voice-assistant support out of the box.',
  ],
  'mobile-accessories': [
    'The {name} is an everyday essential for your phone.',
    'Durable build and fast performance you can rely on daily.',
  ],
  computing: [
    'The {name} upgrades your desk setup for work and play.',
    'Precision engineering with plug-and-play connectivity.',
  ],
  'cameras-drones': [
    'The {name} captures stunning footage from ground or sky.',
    'Stabilized 4K video, smart flight modes and pro-grade optics.',
  ],
  gaming: [
    'The {name} gives you the competitive edge in every match.',
    'Low latency, pro-grade precision and tournament-ready build.',
  ],
};

function buildDescription(categorySlug: string, productName: string): string {
  const [t1, t2] = DESC_TEMPLATES[categorySlug];
  return `${t1.replace('{name}', productName)} ${t2}`;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  /* ------------------------- Wipe old data ------------------------- */
  // FK-safe order: children before parents.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  console.log('Wiped: order items, orders, cart items, products, categories, users');

  /* ------------------------------ Users ----------------------------- */
  const adminHash = await bcrypt.hash(ADMIN.password, 10);
  await prisma.user.create({
    data: {
      email: ADMIN.email,
      passwordHash: adminHash,
      name: ADMIN.name,
      role: ADMIN.role,
    },
  });

  const customerHash = await bcrypt.hash(CUSTOMER_PASSWORD, 10);
  for (const c of CUSTOMERS) {
    await prisma.user.create({
      data: {
        email: c.email,
        passwordHash: customerHash,
        name: c.name,
        role: 'CUSTOMER',
      },
    });
  }

  /* ---------------------------- Categories ---------------------------- */
  const categoryIdBySlug: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const record = await prisma.category.create({
      data: { slug: cat.slug, name: cat.name, description: cat.description },
    });
    categoryIdBySlug[record.slug] = record.id;
  }

  /* ----------------------------- Products ----------------------------- */
  const totalDefs = Object.values(PRODUCT_DEFS).reduce((n, arr) => n + arr.length, 0);
  if (totalDefs !== 100) {
    throw new Error(`Product definitions must total exactly 100, found ${totalDefs}`);
  }

  let productCount = 0;
  let discountedCount = 0;
  let outOfStockCount = 0;
  let inactiveCount = 0;
  const perCategory: Record<string, number> = {};

  for (const cat of CATEGORIES) {
    const defs = PRODUCT_DEFS[cat.slug];
    perCategory[cat.slug] = defs.length;
    for (const def of defs) {
      const slug = `${cat.slug}-${slugify(def.name)}`;
      const price = def.price;

      // ~25% get a comparePrice 10–40% higher than price.
      let comparePrice: Prisma.Decimal | null = null;
      if (rand() < 0.25) {
        comparePrice = toDecimal(price * (1.1 + rand() * 0.3));
        discountedCount++;
      }

      // ~8% are exactly out of stock, rest 1–200.
      const stockRoll = rand();
      const stock = stockRoll < 0.08 ? 0 : 1 + Math.floor(rand() * 200);
      if (stock === 0) outOfStockCount++;

      // ~95% active.
      const isActive = rand() < 0.95;
      if (!isActive) inactiveCount++;

      await prisma.product.create({
        data: {
          slug,
          name: def.name,
          description: buildDescription(cat.slug, def.name),
          price: toDecimal(price),
          comparePrice,
          stock,
          imageUrl: PRODUCT_IMAGES[productCount % PRODUCT_IMAGES.length],
          isActive,
          categoryId: categoryIdBySlug[cat.slug],
        },
      });
      productCount++;
    }
  }

  /* ------------------------------ Summary ------------------------------ */
  const userCount = await prisma.user.count();
  const categoryCount = await prisma.category.count();
  const dbProductCount = await prisma.product.count();
  const dbOrderCount = await prisma.order.count();

  console.log('Seed complete:');
  console.log(`  users: ${userCount} (1 admin + 5 customers)`);
  console.log(`  categories: ${categoryCount}`);
  console.log(`  per category: ${JSON.stringify(perCategory)}`);
  console.log(
    `  products: ${dbProductCount} (created this run: ${productCount}, discounted: ${discountedCount}, out-of-stock: ${outOfStockCount}, inactive: ${inactiveCount})`,
  );
  console.log(`  orders: ${dbOrderCount} (not seeded)`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
