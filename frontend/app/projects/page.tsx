import { layoutClasses } from "@/lib/layout";
import { cn } from "@/lib/utils";

/**
 * Protected projects page - placeholder for future project management
 * This route is protected by Clerk middleware
 */
export default function ProjectsPage() {
  return (
    <div
      className={cn(
        layoutClasses.fullScreen,
        "flex flex-col pt-16"
      )}
    >
      <main className={cn(layoutClasses.scrollableContainer, "flex-1 p-6")}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Your Projects</h1>
          <p className="text-muted-foreground mb-8">
            Manage and view all your video generation projects
          </p>

          {/* Empty state */}
          <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
            <p className="text-muted-foreground text-center">
              No projects yet. Start creating your first video project!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

