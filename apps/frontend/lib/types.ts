/** Shared frontend types mirroring the NestJS API contract. */

export type Role = "ADMIN" | "CUSTOMER";
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface User {
  id: string;
  email: string;
  name: string;
  /** Mobile number from the profile (01XXXXXXXXX), if set. */
  phone?: string | null;
  role: Role;
  createdAt: string;
  /** Present on admin user listings (enable/disable). */
  isActive?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  /** Top-level category id for a subcategory; null for a top-level category. */
  parentId?: string | null;
  /** Display order among siblings (lower first). */
  position?: number;
  _count?: { products: number };
}

/** A top-level category with its subcategories. */
export interface CategoryNode extends Category {
  children: Category[];
}

/** Storefront settings (GET /settings), edited in Admin → Site settings. */
export interface SiteSettings {
  topbarEnabled: boolean;
  topbarLeftTitle: string;
  topbarLeftText: string;
  topbarLeftLink: string;
  announcement: string;
  announcementLink: string;
  supportPhone: string;
  /** Checkout delivery charges (BDT); Dhaka district counts as inside Dhaka. */
  deliveryFeeInsideDhaka: number;
  deliveryFeeOutsideDhaka: number;
  /** Outside Dhaka the charge is paid in advance by bKash / Nagad (when a number is set). */
  advanceOutsideDhaka: boolean;
  bkashNumber: string;
  nagadNumber: string;
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** Decimal from the API may arrive as string or number — normalize with toNumber(). */
  price: number;
  comparePrice?: number | null;
  stock: number;
  /** Cover image (first gallery image). Empty string when the product has no images yet. */
  imageUrl: string;
  /** Gallery, ordered by position. */
  images?: ProductImage[];
  isActive: boolean;
  categoryId: string;
  category?: Category;
  brandId?: string | null;
  brand?: BrandRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  items: Product[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CartItem {
  productId: string;
  quantity: number;
  lineTotal: number;
  product: Pick<
    Product,
    "id" | "name" | "slug" | "price" | "imageUrl" | "stock" | "isActive"
  >;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export interface WishlistItem {
  productId: string;
  createdAt: string;
  product: Pick<
    Product,
    | "id"
    | "name"
    | "slug"
    | "price"
    | "comparePrice"
    | "imageUrl"
    | "stock"
    | "isActive"
  >;
}

export interface ToggleWishlistResult {
  wishlisted: boolean;
  productId: string;
}

export interface ShippingAddress {
  name: string;
  /** House / road / village / area. */
  street: string;
  /** Present on orders placed after the district/upazila/union fields were added. */
  phone?: string;
  email?: string | null;
  union?: string | null;
  upazila?: string;
  district?: string;
  division?: string;
  /** Older orders only have this; newer ones mirror the district here. */
  city: string;
  postalCode: string;
  country: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product?: { id: string; name: string; slug: string; imageUrl: string };
}

export interface Order {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  shippingAddress: ShippingAddress;
  paymentMethod?: string;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  createdAt: string;
  items: OrderItem[];
  user?: { id: string; name: string; email: string; phone?: string | null } | null;
  /** Coupon discount already taken off totalAmount (0 when none). */
  discountAmount?: number;
  couponCode?: string | null;
  /** Delivery charge included in totalAmount. */
  shippingFee?: number;
  shippingZone?: "inside_dhaka" | "outside_dhaka" | null;
  /** bKash / Nagad Transaction ID for an advance delivery charge. */
  transactionId?: string | null;
  notes?: string | null;
  /** Billing contact when the order shipped to a different address. */
  billingAddress?: { name: string; phone: string; street: string; district: string } | null;
  /** Latest return request for this order, if any (customer order endpoints). */
  returnRequest?: CustomerReturn | null;
}

export interface AdminStats {
  totalRevenue: number;
  ordersByStatus: Record<OrderStatus, number>;
  lowStock: { id: string; name: string; slug: string; stock: number }[];
  newCustomers30d: number;
  totalProducts: number;
  totalCustomers: number;
  totalOrders: number;
}

export interface RevenueTrendMonth {
  label: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  imageUrl: string | null;
  unitsSold: number;
  revenue: number;
}

/** Product sort values accepted by GET /products. */
export type ProductSort = "price-asc" | "price-desc" | "newest" | "name";

/* ---------------------------------------------------------------- coupons */

export type DiscountType = "PERCENT" | "FLAT";

export interface Coupon {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  minOrder: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  /** Sum of discounts given on non-cancelled orders (admin list only). */
  totalDiscount?: number;
}

export interface CouponPreview {
  code: string;
  type: DiscountType;
  value: number;
  discount: number;
  total: number;
}

/* ---------------------------------------------------------------- reviews */

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  reply: string | null;
  createdAt: string;
  author: string;
}

export interface ProductReviews {
  average: number;
  count: number;
  distribution: { stars: number; count: number }[];
  reviews: PublicReview[];
}

export interface ReviewEligibility {
  canReview: boolean;
  reason?: string;
  status?: ReviewStatus;
}

export interface AdminReview {
  id: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  product: { id: string; name: string; slug: string; imageUrl: string };
}

/* ---------------------------------------------------------------- returns */

export type ReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED";

export interface CustomerReturn {
  id: string;
  status: ReturnStatus;
  reason: string;
  refundAmount: number | null;
  adminNote: string | null;
  createdAt: string;
}

export interface AdminReturn extends CustomerReturn {
  details: string | null;
  updatedAt: string;
  user: { id: string; name: string; email: string };
  order: {
    id: string;
    totalAmount: number;
    createdAt: string;
    items: { productId: string; name: string; quantity: number; unitPrice: number }[];
  };
}

/* ---------------------------------------------------------------- banners */

/** A live homepage banner (public endpoint): just an image and where a click goes. */
export interface Banner {
  id: string;
  /** Alt text for the image. */
  title: string;
  imageUrl: string;
  /** Product page, or the custom link when no product is set; null = not clickable. */
  href: string | null;
}

export interface AdminBanner extends Banner {
  productId: string | null;
  product: { id: string; name: string; slug: string; imageUrl: string; isActive: boolean } | null;
  ctaHref: string | null;
  isActive: boolean;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------------------------------------------------------------- brands */

/** Brand as embedded in a product. */
export interface BrandRef {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

/** Public brand list entry (active brands only). */
export interface Brand extends BrandRef {
  /** Wide cover image for the brand page. */
  bannerUrl: string | null;
  productCount: number;
}

/** GET /brands/:slug — header of the storefront brand page. */
export interface BrandDetail extends Brand {
  description: string | null;
}

export interface AdminBrand extends Brand {
  description: string | null;
  isActive: boolean;
  createdAt: string;
}
