import { BrowseCatalog, type BrowseSearchParams } from "@/components/BrowseCatalog";

export default async function FolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: BrowseSearchParams;
}) {
  const { slug } = await params;
  return <BrowseCatalog slug={slug} searchParams={searchParams} />;
}
