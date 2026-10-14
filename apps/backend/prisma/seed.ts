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

/* Product image by slug — each product gets a matching image. */
const PRODUCT_IMAGE_BY_SLUG: Record<string, string> = {
  'audio-aeropods-lite-true-wireless': 'https://www.photomaticai.com/images/processed/ai-generated-images/models_ideogram-v2a_ai-image-generator_product-pho_Sleek_Wireless_Earbuds_Product_Shoot.webp',
  'audio-airdrum-wireless-headphones': 'https://static.vecteezy.com/system/resources/thumbnails/050/025/508/small/elegant-metallic-headphones-minimalistic-design-profile-view-isolated-on-a-white-background-highquality-image-free-photo.jpg',
  'audio-basspod-neckband-earphones': 'https://cdn.createvision.ai/templates/community/community-high-end-product-mockup-for-wireless-earbuds-1254-result-2.jpg',
  'audio-boombox-mini-bluetooth-speaker': 'https://easymedia.online/uploads/products/14986591252555-Bluetooth-Speaker-18.jpg',
  'audio-clearcall-usb-headset': 'https://img.chinagamingheadsets.com/photo/chinagamingheadsets/editor/20240925165519_56758.jpg',
  'audio-hifi-dac-portable-amplifier': 'https://i.ebayimg.com/images/g/CHAAAOSwZ0RmrC~j/s-l1600.jpg',
  'audio-karaoke-mic-pro-wireless': 'https://images.directnine.io/products/HAB0D842RF5R/1_51aE3CgWaXL_desktop.jpg',
  'audio-novabuds-pro-wireless-earbuds': 'https://studis.io/images/showcase/electronics-before.jpg',
  'audio-retroturn-vinyl-bluetooth-speaker': 'https://manager-test.otcommerce.com/plugin/request/ImagePro?i=aHR0cHM6Ly9jYnUwMS5hbGljZG4uY29tL2ltZy9pYmFuay9PMUNOMDFkWU41VU4yNXJFa21qdHpTZF8hITIyMTc5MDUzMzc1NzktMC1jaWIuNjAweDYwMC5qcGc%3D',
  'audio-sleepbuds-noise-masking-earbuds': 'https://cdn.createvision.ai/templates/community/community-high-end-product-mockup-for-wireless-earbuds-1254-result-1.jpg',
  'audio-soundbar-slim-2-1': 'https://cdn.shopify.com/s/files/1/0617/6338/7579/products/SOUNDBAR300-1.jpg?v=1655137030&width=1500',
  'audio-soundcube-smart-speaker': 'https://www.articulo14.es/main-files/uploads/2024/03/alexa.jpg?x86704',
  'audio-studiomax-over-ear-headphones': 'https://creatorslibrary-prod.s3.eu-north-1.amazonaws.com/wp-content/uploads/2025/08/headphones_1-1.png',
  'audio-studiomic-usb-condenser': 'https://frontiergeneralhardware.net/cdn/shop/files/USB-Microphone-Professional-Condenser-Mic-For-PC-Computer-Laptop-Recording-Studio-Singing-Game-Streaming-Mikrofon-Live__30237.1665466247.1280.1280.png?v=1772270252&width=1096',
  'audio-thunderbass-party-speaker': 'https://cms.cloudinary.vpsvc.com/image/fetch/c_scale,dpr_1.0,f_auto,q_auto:best,w_816/https%3A%2F%2Frendering.documents.cimpress.io%2Fv1%2Fvistaprint-prod%2Fpreview%3Fwidth%3D1500%26scene%3Dhttps%253A%252F%252Fcdn.scenes.documents.cimpress.io%252Fv3%252Ftransformations%252Frecolor%253FsceneUri%253Dhttps%25253A%25252F%25252Fcdn.scenes.documents.cimpress.io%25252Fv3%25252Fassets%25252F86982b5f-c7d8-4117-a6a3-db734f456685%25252Frevisions%25252F9a8a36d1-f890-4a02-afd3-d88fcfb8da4f%25252Fcontent%2526r%253D192%2526g%253D192%2526b%253D192',
  'cameras-drones-actioncam-float-grip': 'https://www.rockitx.com/templates/img/ec-5.png',
  'cameras-drones-actioncam-x5-waterproof': 'https://img-edg.joomcdn.net/b2a56d74cf7089b84e640980f2fa93bc3f9499eb_original.jpeg',
  'cameras-drones-camlight-led-panel': 'https://www.ziiosmarts.com/cdn/shop/files/transparent-Photoroom-Photoroom_2.png?v=1756196018&width=700',
  'cameras-drones-dronebag-hard-case': 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/company_57704/images/7bd24de2-b746-4476-842b-76602897d80d.jpg',
  'cameras-drones-gimbalpro-3-axis': 'https://ikancorp.com/prod1/wp-content/uploads/2019/04/HorizonOne08.jpg',
  'cameras-drones-lenspro-macro-kit': 'https://www.bhphotovideo.com/images/fb/apexel_apl_hd5_4k_hd_mobile_phone_1458421.jpg',
  'cameras-drones-lenspro-wide-angle': 'https://cdn.shopify.com/s/files/1/0694/0242/7619/files/6Apexel-5-in-1-Phone-Camera-Lens-Kit.jpg?v=1736821607',
  'cameras-drones-skyhawk-4k-drone': 'https://aerodrone-europe.fr/cdn/shop/files/photo_avec_camera.png?v=1725909326&width=713',
  'cameras-drones-skyhawk-battery-plus': 'https://lh3.googleusercontent.com/6OBu_TAhrXCH0RWcRCvPM_1B01kIuhMk-24NQSlE6gcRtb6Rl5EBCdg2Mr-w8K2jbCZypEdN47_WfksRFPbltGUY7gA6vl89eXnoIsoNzLjpfQ',
  'cameras-drones-skyhawk-fpv-racer': 'https://image.made-in-china.com/2f0j00lQRBVwFzAcoq/Latest-Design-Aerial-Camera-Drone-for-Supermarket-Promotional-Items.webp',
  'cameras-drones-skyhawk-mini-se': 'https://chinsey.com/plugin/request/ImagePro?i=aHR0cHM6Ly9jYnUwMS5hbGljZG4uY29tL2ltZy9pYmFuay9PMUNOMDE4UHdJeU0yOW5MaFEwT3FsT18hITIyMDA2OTkxNjgxMTItMC1jaWIuanBnP19fcl9fPTE2NzY5NTA3OTkzMzQ%3D',
  'cameras-drones-skyhawk-prop-guard-set': 'https://dhamaka-point.myshopify.com/cdn/shop/files/drone-camera.png?v=1767846182&width=3840',
  'cameras-drones-tripodmax-carbon-2m': 'https://m.media-amazon.com/images/I/71eoYN67r2L._AC_SL2048_.jpg',
  'computing-cabledock-organizer-kit': 'https://thedesitech.com/cdn/shop/files/data-charging-cable-usb-a-to-usb-c-plug.jpg?crop=region&crop_height=872&crop_left=0&crop_top=1&crop_width=872&v=1768130092&width=600',
  'computing-coolpad-laptop-stand': 'https://cdn.shopify.com/s/files/1/0271/9963/5589/products/USBCDockMSTDualHDMIDualScreenDualDisplayAdapterHub_USBTyp_6.jpg?v=1622630902',
  'computing-deskmat-xxl-rgb': 'https://m.media-amazon.com/images/I/71zM96gu4bL.jpg',
  'computing-ergotrack-trackball': 'https://img.hjigt.com/uploader/a35d35b56873189fc4fdc5e4cde8eb61eaa06126.jpg?x-oss-process=image/resize,w_1000,m_mfit/format,webp',
  'computing-keyforge-mech-keyboard': 'https://m.media-amazon.com/images/I/71NHYvhwPvL.jpg',
  'computing-keyforge-mini-65-percent': 'https://kbdlab.co.kr/files/attach/images/340/057/405/006/2180ff35c9faaf5344a8ae7c523d3431.JPG',
  'computing-monitorbar-screen-light': 'https://storage.zarehbin.com/media/image/62439/32408932/65999289.webp',
  'computing-pixelpad-drawing-tablet': 'https://image.made-in-china.com/226f3j00dnbUveTYJGzE/Type-C-Hub-3-0-OTG-USB-Hub-RJ45-Adapter-HDMI-Compatible-Pd-Docking-Station-for-MacBook-PRO-Air-USB-C-Hub.webp',
  'computing-powerstrip-smart-6-outlet': 'https://static4.b2b.monstelo.com/eng_pm_BASEUS-GAN3-PRO-FAST-UNIVERSAL-GAN-CHARGER-2-X-USB-TYPE-C-USB-CABLE-USB-TYPE-C-USB-TYPE-C-65W-PD3-0-QC4-0-AFC-WHITE-CCGP050102-107800_1.jpg',
  'computing-ssdvault-1tb-portable': 'https://cdn.shopify.com/s/files/1/0887/8266/8103/files/image_-_2025-12-29T020601.854_1.jpg?v=1766956053',
  'computing-streamcam-4k-webcam': 'https://www.gadis.fr/web/image/product.product/9545/image_512/%5BNV-C4K120-EDU%5D%20%28NV-C4K120-EDU%29%20Cam%C3%A9ra%20USB%20Nivian%20-%20Resolution%204K%20%283840x2160%29%20-%20Angle%20de%20vision%20120%C2%B0%20-%20Double%20microphone%20int%C3%A9gr%C3%A9%20-%20Cadrage%20automatique%20-%20Plug%20%26amp%3B%20Play?unique=550cce7',
  'computing-swiftmouse-pro-wireless': 'https://img4.sellvia.com/uploads/2025/08/22/d611a953b9c75c74bcc515eed37b89af.jpg-full.webp',
  'computing-ultradock-11-in-1-usb-c': 'https://site.cdnfile.io/www.sunpoweredchargers.com/452ca6c83d53e4ade66f2ffb70878f5e.webp',
  'computing-volthub-7-port-usb-hub': 'https://image.made-in-china.com/226f3j00eCdMqYZBlLkt/Ultimate-4-in-1-USB-C-Hub-Dock-for-MacBook-and-PC.webp',
  'gaming-arcademini-handheld': 'https://i.etsystatic.com/59910474/r/il/e883b6/7773897198/il_800x800.7773897198_8jk3.jpg',
  'gaming-arcadestick-retro-pro': 'https://m.media-amazon.com/images/I/71QtqKvI9DL.jpg',
  'gaming-chatmix-gaming-mixer': 'https://i5.walmartimages.com/seo/8-Channel-Professional-Audio-Mixer-Console-Sound-Board-48V-Phantom-Power-USB-Audio-Interface-Live-Show-Streaming-Recording-Music-Stage-Karaoke_bf2ffebd-9d29-47a4-a5bc-042ab4b14d5b.41d6132760396b83a53d9004d8a0fa42.png',
  'gaming-gamedock-switch-station': 'https://d10ujpxt0sdyrk.cloudfront.net/eyJidWNrZXQiOiJueHQtZm91bmRhdGlvbi1mdW5zdHVmZiIsImtleSI6InByb2R1Y3RfaW1hZ2VzXC8zNC0xMzAyMDFfNmE2YjM0NTNkYThiYi5qcGcifQ==',
  'gaming-gamestream-capture-4k': 'https://down-ph.img.susercontent.com/file/cn-11134207-820l4-ms6ncostvcw88f',
  'gaming-keyforge-game-keypad': 'https://kbdlab.co.kr/files/attach/images/340/327/388/003/d0587ff09dc0011f4a4046384a186a30.JPG',
  'gaming-streamdeck-mini-6-key': 'https://image.made-in-china.com/226f3j00BJSqckogyebH/3-in-1-USB-Type-C-Docking-Hub-to-HDMI-USB3-0-with-Pd2-0.webp',
  'gaming-strikemouse-26k-dpi': 'https://img.mysourcify.com/2021/04/09/4b8c9880c3fa2b667214b4f99896726d.jpg?x-oss-process=image/format,jpg/quality,Q_81',
  'gaming-strikepad-elite-wireless': 'https://img.snappr.com/1U0FEF3-0_63U5yr5tF-ZBviyZ4=/fit-in/600x0/723c3141-f29f-4d83-b106-94f5d0d7d677',
  'gaming-strikepad-pro-controller': 'https://d3kjluh73b9h9o.cloudfront.net/optimized/4X/e/8/1/e81fbebfa82507a09537f50b5633b8888e2212d0_2_1024x682.jpeg',
  'gaming-voltchair-rgb-gaming': 'https://www.clearhalo.com/cdn/shop/files/5881923.jpg?v=1743411022&width=550',
  'gaming-voltheadset-7-1-gaming': 'https://i5.walmartimages.com/asr/263709da-7552-48db-accd-4bd557652e5c_1.5327a176829319e9c53f0a341242e3d7.jpeg',
  'gaming-voltpad-cooling-stand': 'https://www.unitek-products.com/cdn/shop/files/UNITEK_D1120A_6-in-1_USB-C_Hub_with_M.2_SSD_Enclosure_product_side_v4_2ce229e8-4e8d-40ec-a8b8-db62f8f74555.jpg?v=1756959192&width=800',
  'gaming-vrsense-headset': 'https://api.asicentral.com/v1/media/23939086?size=large',
  'mobile-accessories-budcase-wireless-earbud-case': 'https://xiaomistore.ir/uploads/editor/a41e17.jpg',
  'mobile-accessories-cablekit-braided-3-pack': 'https://www.picclickimg.com/GoQAAOSwB0hjtnTe/2M-1M-Type-C-to-USB-30-Data-Charger.webp',
  'mobile-accessories-carmount-magsafe-pro': 'https://i5.walmartimages.com/asr/27ce83fc-bbaa-424a-8c9a-91568b3fa3d8.638fcb4cf5e99e0197cd8701a6b64c1f.jpeg',
  'mobile-accessories-gripcase-armor-pro': 'https://i.ebayimg.com/images/g/ASkAAOSwmyZfher9/s-l1200.jpg',
  'mobile-accessories-lenskit-pro-mobile': 'https://sc02.alicdn.com/kf/H015d54c8c3e74df1b844c18aa4e5eb327/159960/H015d54c8c3e74df1b844c18aa4e5eb327.jpg',
  'mobile-accessories-magcharge-15w-wireless-pad': 'https://d2b8wt72ktn9a2.cloudfront.net/mediocre/image/upload/c_pad,dpr_2.0,f_auto,h_496,q_auto,w_496/ojagc9ltptcbuxsumwkd.webp',
  'mobile-accessories-magwallet-leather-card': 'https://ae01.alicdn.com/kf/HTB1SNJrxlmWBuNkSndVq6AsApXah.jpg',
  'mobile-accessories-ringlight-mini-vlog': 'https://media.velz.it/media/6P051W9ZTO/0?w=1920',
  'mobile-accessories-screenguard-ceramic-2-pack': 'https://c.cdnmp.net/505499865/p/l/5/smart-magneto-case-for-motorola-moto-g14-navy~8461325.jpg',
  'mobile-accessories-selfiestick-pro-tripod': 'https://i.ebayimg.com/images/g/kFwAAeSwUSBonC5Z/s-l400.jpg',
  'mobile-accessories-standfold-aluminum-dock': 'https://d3qyjp7jfs525i.cloudfront.net/d002/20260819/88b96b974f3f44869a2c1d01b6367e3c.png?x-oss-process=style/webp',
  'mobile-accessories-turbobrick-65w-gan-charger': 'https://p.globalsources.com/IMAGES/PDT/B6038527127/PD-charger-gan-charger-fast-phone-charger.jpg',
  'mobile-accessories-turbocable-100w-usb-c-2m': 'https://bsg-i.nbxc.com/product/54/00/3c/55084fd7cea9ed3d6a8acb6dc3.png',
  'mobile-accessories-voltcore-20000mah-power-bank': 'https://empratour.com/wp-content/uploads/2022/03/314703.jpg',
  'mobile-accessories-voltcore-30000mah-pd': 'https://i3.wp.com/shop.aynalfahad.com/public/tenant/tenantffdae9dd-cbee-42bc-8823-e6496e296b25/2024/Nov/5hu5go5DOD7yzAH53qTEohLpG6bQpNqzMbFeDwF1.jpg',
  'mobile-accessories-voltcore-slim-10000mah': 'https://promoalliance.co.za/_next/image?url=https%3A%2F%2Fimages.thepromogroup.co.za%2Fproducts%2F2026%2F01%2F1769734363_vk9025bk_4.png&w=640&q=75',
  'smart-home-airpure-hepa-purifier': 'https://m.media-amazon.com/images/I/61nC6ZpqJwL.jpg',
  'smart-home-chimebox-smart-doorbell': 'https://images.squarespace-cdn.com/content/v1/68644306eabbe53049fe2217/2bee00b4-3ecf-4898-84fc-1096e809f73e/FC20828A-E07D-4388-B1F0-40348ECA62B4.png?format=2500w',
  'smart-home-curtainbot-auto-opener': 'https://eu-images.contentstack.com/v3/assets/blt6b0f74e5591baa03/blt3bf9eb96b971ab5e/63196e15bd2c7e2f4dc9179f/alexa-4758340_1920.jpg?width=960&auto=webp&quality=80&disable=upscale',
  'smart-home-doorbell-pro-video': 'https://i0.wp.com/vsb.bnk.mybluehost.me/website_bf0b02ec/wp-content/uploads/2026/02/Video-Doorbell-4.webp?w=1080&ssl=1',
  'smart-home-echonest-smart-hub': 'https://www.ecommerceideas.it/wp-content/uploads/2026/06/Alexa-for-Shopping-1-2048x1152.jpg',
  'smart-home-gardensense-soil-monitor': 'https://www.seamgen.com/hubfs/using-alexa-at-home-2025-01-09-03-08-19-utc.jpg',
  'smart-home-lockpro-fingerprint-deadbolt': 'https://www.smartdoor-lock.com/photo/smartdoor-lock/editor/20240703164044_38169.png',
  'smart-home-lumabulb-rgb-smart-bulbs-4-pack': 'https://ae01.alicdn.com/kf/H602d970cc7cd4826b9c0e843becd732aQ.jpg',
  'smart-home-lumastrip-led-5m': 'https://www.ibright.id/wp-content/uploads/2023/06/smart-bulb@150x-100.jpg',
  'smart-home-plugmini-smart-plugs-4-pack': 'https://karakun.github.io/assets/featuredImages/alexa.png',
  'smart-home-robovac-s9-lidar': 'https://images.rawpixel.com/image_social_landscape/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAxL21vdGFybzdfcm9ib3RfdmFjdXVtX2NsZWFuZXJfb25fd2hpdGVfYmFja2dyb3VuZF85OTI0ZjU5Ny1kY2NiLTQ2NjMtYmMxMC0wYjJmOTJhOWNiYzVfMS5qcGc.jpg',
  'smart-home-securecam-360-indoor': 'https://cls-testing.netlify.app/static/media/View%20of%20round%20modern%20webcam%20with%20shadows%20background.e42f94b1d84608156fbd.png',
  'smart-home-sensehub-motion-sensors-3-pack': 'https://framerusercontent.com/images/tQNJFTvHR1Mdpb9ccb1otJ5vKHc.jpg?width=1000&height=1500',
  'smart-home-thermosmart-wifi-thermostat': 'https://cdn.smartdiszkont.hu/images/products/191/191694/avatto-wt598-1t1-wifi-intelligens-termosztat-191694-1024-11.webp',
  'wearables-aerowatch-classic-leather': 'https://shaheer-official.github.io/smartwear-ecommerce-ui/Images/NewArrival4.png',
  'wearables-aerowatch-gt-smartwatch': 'https://shaheer-official.github.io/smartwear-ecommerce-ui/Images/NewArrival4.png',
  'wearables-aerowatch-se-sport': 'https://shaheer-official.github.io/smartwear-ecommerce-ui/Images/NewArrival8.png',
  'wearables-fitclip-activity-tracker': 'https://static-01.daraz.lk/p/e3eab29188d6f7e72e3e834c6957e35a.jpg',
  'wearables-haloring-smart-ring': 'https://cdn.spacegone.com/uploader/6e0ae6a2af7e7971db27917359bf7b9723b81dbd.webp',
  'wearables-lumaband-led-fitness': 'https://f.nooncdn.com/p/v1581667563/N20090057A_1.jpg?width=800',
  'wearables-orbitwatch-kids-gps': 'https://shaheer-official.github.io/smartwear-ecommerce-ui/Images/SmartWatch10.jpg',
  'wearables-pulseband-6-fitness-tracker': 'https://imgservice.suning.cn/uimg1/sniss/improve/BSjHozNw75xQBCBWkDxSEQ.jpg_400w_400h_4e',
  'wearables-pulsewatch-ecg-monitor': 'https://staging.ololoexpress.com/media/wp/2025/05/CCIT-CT-2-Smart-Watch.webp',
  'wearables-sleepsense-tracker-band': 'https://images.squarespace-cdn.com/content/v1/6911b12ee9bb1e19b3f6aba1/1762767161998-DGIO72ACW9EVVKYDO9XL/wsp-global-wearable-design-detail.jpg?format=1500w',
  'wearables-stridepod-running-sensor': 'https://cdn.allware.com/images/53ecbe41-a772-4b9d-bcf5-a6dde607fc69?width=256&format=webp',
  'wearables-tagmate-bluetooth-tracker': 'https://promotionstudio.hu/img/62700/PSAP864097-10/PSAP864097-10.webp',
  'wearables-titanwatch-ultra-rugged': 'https://shaheer-official.github.io/smartwear-ecommerce-ui/BGremoved/BGremoved4.png',
  'wearables-vitalpatch-health-monitor': 'https://burst.shopifycdn.com/photos/light-blue-mi-band.jpg?width=1850&format=pjpg&exif=0&iptc=0',
};

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
          imageUrl: PRODUCT_IMAGE_BY_SLUG[slug] ?? '',
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
