import EditProduct from "@/components/admin/products/EditProduct";

export default async function AdminEditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditProduct key={id} id={id} />;
}
