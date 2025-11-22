'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({
  className,
  checked,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange?.(e.target.checked);
    props.onChange?.(e);
  };

  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="sr-only"
        {...props}
      />
      <div
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded border-2 transition-colors',
          checked
            ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
            : 'border-border bg-background',
          props.disabled && 'opacity-50 cursor-not-allowed',
          !props.disabled && 'cursor-pointer',
          className
        )}
      >
        {checked && <Check className="h-3 w-3 stroke-[2.5]" />}
      </div>
    </label>
  );
}

