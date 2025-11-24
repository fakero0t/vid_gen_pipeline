'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'destructive';
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn"
      onClick={onCancel}
    >
      <div 
        className="bg-card border border-border rounded-lg p-6 max-w-md mx-4 shadow-xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="space-y-2 mb-6">
          <p className="text-sm text-muted-foreground">{message}</p>
          {variant === 'destructive' && (
            <p className="text-sm font-medium" style={{ color: 'rgb(255, 81, 1)' }}>
              Warning: This action cannot be undone.
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className={variant === 'destructive' 
              ? 'bg-[rgb(255,81,1)] text-white hover:bg-[rgb(255,100,20)]' 
              : ''}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );

  // Use portal to render outside the carousel container to avoid stacking context issues
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  
  return modalContent;
}

