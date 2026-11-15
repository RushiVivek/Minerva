import { BrowseCatalog, type BrowseSearchParams } from "@/components/BrowseCatalog";

export default function HomePage({ searchParams }: { searchParams: BrowseSearchParams }) {
  return <BrowseCatalog searchParams={searchParams} />;
}
