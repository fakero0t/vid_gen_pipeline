export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  uploadMode: (process.env.NEXT_PUBLIC_UPLOAD_MODE || 'nerf') as 'nerf' | 'product',
  
  isNerfMode: () => config.uploadMode === 'nerf',
  isProductMode: () => config.uploadMode === 'product',
} as const;

