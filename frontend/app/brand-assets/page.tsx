import { layoutClasses } from "@/lib/layout";
import { cn } from "@/lib/utils";

/**
 * Protected brand assets page - placeholder for future brand asset management
 * This route is protected by Clerk middleware
 */
export default function BrandAssetsPage() {
  return (
    <div
      className={cn(
        layoutClasses.fullScreen,
        "flex flex-col pt-16"
      )}
    >
      <main className={cn(layoutClasses.scrollableContainer, "flex-1 p-6")}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Brand Assets</h1>
          <p className="text-muted-foreground mb-8">
            Manage your brand assets including logos, colors, fonts, and style guidelines
          </p>

          {/* Empty state */}
          <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
            <p className="text-muted-foreground text-center">
              No brand assets yet. Upload your first brand asset to get started!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

