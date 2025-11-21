import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center font-display font-bold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/20 dark:focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-30',
          {
            'bg-black dark:bg-white text-white dark:text-black hover:scale-[1.02] active:scale-95 shadow-md hover:shadow-lg': variant === 'default',
            'bg-destructive text-white dark:text-black hover:scale-[1.02] active:scale-95 shadow-md hover:shadow-lg': variant === 'destructive',
            'border-2 border-foreground bg-transparent text-foreground hover:bg-secondary hover-lift': variant === 'outline',
            'bg-secondary text-foreground hover:bg-secondary/80 hover-lift': variant === 'secondary',
            'hover:bg-secondary': variant === 'ghost',
            'text-foreground underline-offset-4 hover:underline font-bold': variant === 'link',
            'h-9 px-4 py-2 text-sm rounded-full': size === 'default',
            'h-8 px-3 py-1.5 text-xs rounded-full': size === 'sm',
            'h-11 px-6 py-2.5 text-base rounded-full': size === 'lg',
            'h-9 w-9 rounded-full': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };

