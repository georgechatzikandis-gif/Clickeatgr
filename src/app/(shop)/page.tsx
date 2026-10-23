import { HomeBrowser } from "@/components/home-browser";
import { listBusinessCards, listCategories } from "@/server/catalog";

export default async function HomePage() {
  const [businesses, categories] = await Promise.all([listBusinessCards("rodos"), listCategories()]);
  return (
    <HomeBrowser
      businesses={businesses}
      categories={categories.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon }))}
    />
  );
}
