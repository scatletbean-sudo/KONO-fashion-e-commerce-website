import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL!;

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const product = await prisma.product.findFirst({
    where: {
      name: "KONO Black Cargo Pants V2",
    },
    include: {
      variants: {
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
  });

  if (!product || !product.variants[0]) {
    throw new Error("Test product or variant not found");
  }

  const variant = product.variants[0];

  const orderNumber = `KONO-BANK-${Date.now()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,

      status: "PENDING",

      subtotal: 1290000,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      totalAmount: 1290000,

      currency: "VND",

      customerEmail: "test@kono.local",
      customerPhone: "0900000000",
      customerName: "KONO Bank Test Customer",

      notes: "Test order for BANK_TRANSFER payment",

      items: {
        create: {
          productId: product.id,
          variantId: variant.id,

          productName: product.name,
          sku: variant.sku,

          quantity: 1,

          unitPrice: 1290000,
          totalPrice: 1290000,
        },
      },

      payment: {
        create: {
          method: "BANK_TRANSFER",
          status: "PENDING",
          amount: 1290000,
        },
      },

      shipment: {
        create: {
          status: "PENDING",
          shippingAddress:
            "KONO Test Address, Ho Chi Minh City, Vietnam",
        },
      },
    },

    include: {
      payment: true,
    },
  });

  console.log("Test bank transfer order created:");
  console.log("Order ID:", order.id);
  console.log("Order Number:", order.orderNumber);
  console.log("Payment ID:", order.payment?.id);
  console.log("Payment Method:", order.payment?.method);
  console.log("Payment Status:", order.payment?.status);
  console.log("Amount:", order.payment?.amount);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });