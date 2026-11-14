import { BrowseCatalog } from "@/components/BrowseCatalog";

export default function HomePage() {
  return <BrowseCatalog endpoint="/api/opds/2.0/catalog" title="Good books, close by." root />;
}
