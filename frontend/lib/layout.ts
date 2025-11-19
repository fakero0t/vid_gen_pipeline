/**
 * Layout utility functions and CSS class helpers
 * for full-height layouts without scrolling
 */

/**
 * CSS class names for full-height layouts
 */
export const layoutClasses = {
  /**
   * Full screen height without scrolling
   * Use on root container to prevent page-level scrolling
   */
  fullScreen: "h-screen overflow-hidden",
  
  /**
   * Full height container that can scroll internally
   * Use for content areas that need to scroll within screen bounds
   */
  scrollableContainer: "h-full overflow-y-auto",
  
  /**
   * Flex container that fills available height
   * Use for layouts that need to distribute space
   */
  flexContainer: "h-full flex flex-col",
} as const;

/**
 * Helper function to combine layout classes
 */
export function getLayoutClasses(...classes: string[]): string {
  return classes.filter(Boolean).join(" ");
}

