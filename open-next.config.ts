import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// All pages are rendered fresh on every request (live orders and opening hours), so no
// incremental cache (R2) is needed.
export default defineCloudflareConfig({});
