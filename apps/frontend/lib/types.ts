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
  imageUrl: string;
  isActive: boolean;
  categoryId: string;
  category?: Category;
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

export interface ShippingAddress {
  name: string;
  street: string;
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
  createdAt: string;
  items: OrderItem[];
}

export interface AdminStats {
  totalRevenue: number;
  ordersByStatus: Record<OrderStatus, number>;
  lowStock: { id: string; name: string; slug: string; stock: number }[];
  newCustomers30d: number;
}

/** Product sort values accepted by GET /products. */
export type ProductSort = "price-asc" | "price-desc" | "newest" | "name";
