import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

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

  if (!product) {
    throw new Error("Test product not found");
  }

  const variant = product.variants[0];

  if (!variant) {
    throw new Error("No active variant found for test product");
  }

  const quantity = 1;
  const unitPrice = variant.priceOverride ?? product.basePrice;
  const subtotal = unitPrice * quantity;

  const orderNumber = `KONO-TEST-${Date.now()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,

      status: "PENDING",

      subtotal,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      totalAmount: subtotal,

      currency: "VND",

      customerEmail: "test@kono.local",
      customerPhone: "0900000000",
      customerName: "KONO Test Customer",

      notes: "Test order for admin Order Detail",

      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,

            productName: product.name,
            sku: variant.sku,

            quantity,
            unitPrice,
            totalPrice: subtotal,
          },
        ],
      },

      payment: {
        create: {
          method: "COD",
          status: "PENDING",
          amount: subtotal,
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
      items: true,
      payment: true,
      shipment: true,
    },
  });

  console.log("\nTEST ORDER CREATED");
  console.log("------------------------------");
  console.log("Order ID:", order.id);
  console.log("Order Number:", order.orderNumber);
  console.log("Product:", product.name);
  console.log("SKU:", variant.sku);
  console.log("Unit Price:", unitPrice);
  console.log("Total:", order.totalAmount);
  console.log("Payment:", order.payment?.method);
  console.log("Shipment:", order.shipment?.status);
  console.log("------------------------------\n");
}

main()
  .catch((error) => {
    console.error("\nFAILED TO CREATE TEST ORDER\n");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });