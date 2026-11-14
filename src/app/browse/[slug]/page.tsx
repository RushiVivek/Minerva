import { BrowseCatalog } from "@/components/BrowseCatalog";

export default async function FolderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BrowseCatalog endpoint={`/api/opds/2.0/catalog/${encodeURIComponent(slug)}`} title={slug.replaceAll("-", " ")} />;
}
