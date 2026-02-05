/**
 * useAttachments hook - File attachment handling for chat
 */

import React from 'react';

const { useState, useCallback, useRef } = React;

// Attachment interface
export interface Attachment {
    id: string;
    file: File;
    name: string;
    type: string;
    size: number;
    preview?: string;
    base64?: string;
}

// Direct Line attachment format
export interface DirectLineAttachment {
    contentType: string;
    contentUrl: string;
    name: string;
}

// Attachment options
export interface AttachmentOptions {
    maxFileSize?: number;       // Max file size in bytes
    maxFiles?: number;          // Max number of files
    compressImages?: boolean;   // Whether to compress images
    imageQuality?: number;      // JPEG quality 0-1
    maxImageDimension?: number; // Max width/height for images
}

// Result of adding files
export interface AddFilesResult {
    success: boolean;
    error?: string;
    added?: number;
}

// Allowed file types - no executables or archives
const ALLOWED_TYPES: Record<string, string[]> = {
    // Images
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'image/heic': ['.heic'],
    'image/heif': ['.heif'],
    'image/bmp': ['.bmp'],
    // Documents
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/rtf': ['.rtf']
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];

const DEFAULT_OPTIONS: Required<AttachmentOptions> = {
    maxFileSize: 3.5 * 1024 * 1024,  // 3.5MB
    maxFiles: 5,
    compressImages: true,
    imageQuality: 0.85,
    maxImageDimension: 2048
};

/**
 * Compress an image file and return base64 data
 */
async function compressImage(
    file: File,
    quality: number,
    maxDimension: number
): Promise<{ base64: string; preview: string }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }

                // Create canvas and compress
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Get compressed base64 - use JPEG for better compression
                const outputType = file.type === 'image/png' && file.type.includes('transparent')
                    ? 'image/png'
                    : 'image/jpeg';
                const base64 = canvas.toDataURL(outputType, quality);

                // Create smaller preview for UI (max 200px)
                const previewCanvas = document.createElement('canvas');
                const previewSize = 200;
                let previewWidth = width;
                let previewHeight = height;

                if (previewWidth > previewSize || previewHeight > previewSize) {
                    if (previewWidth > previewHeight) {
                        previewHeight = (previewHeight / previewWidth) * previewSize;
                        previewWidth = previewSize;
                    } else {
                        previewWidth = (previewWidth / previewHeight) * previewSize;
                        previewHeight = previewSize;
                    }
                }

                previewCanvas.width = previewWidth;
                previewCanvas.height = previewHeight;
                const previewCtx = previewCanvas.getContext('2d');
                if (previewCtx) {
                    previewCtx.drawImage(img, 0, 0, previewWidth, previewHeight);
                }
                const preview = previewCanvas.toDataURL('image/jpeg', 0.7);

                console.log(`📷 Image compressed: ${file.name} - Original: ${img.width}x${img.height}, Compressed: ${Math.round(width)}x${Math.round(height)}, Size: ${Math.round(base64.length * 0.75 / 1024)}KB`);
                resolve({ base64, preview });
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Read a non-image file and return base64 data
 */
async function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            resolve(result);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Get file extension icon for preview
 */
export function getFileIcon(type: string): string {
    if (IMAGE_TYPES.includes(type)) return '🖼️';
    if (type === 'application/pdf') return '📕';
    if (type.includes('word') || type.includes('document')) return '📘';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📗';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📙';
    if (type.includes('text') || type.includes('csv')) return '📄';
    return '📎';
}

/**
 * Check if file type is allowed
 */
function isAllowedType(file: File): boolean {
    // Check MIME type
    if (ALLOWED_TYPES[file.type]) return true;

    // Check extension as fallback
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return Object.values(ALLOWED_TYPES).flat().includes(ext);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Hook return type
 */
export interface UseAttachmentsReturn {
    attachments: Attachment[];
    isProcessing: boolean;
    addFiles: (files: FileList) => Promise<AddFilesResult>;
    removeAttachment: (id: string) => void;
    clearAttachments: () => void;
    getDirectLineAttachments: () => DirectLineAttachment[];
    openFilePicker: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    getAcceptString: () => string;
    hasAttachments: boolean;
    totalSize: number;
}

/**
 * Hook for managing file attachments
 */
export function useAttachments(options: AttachmentOptions = {}): UseAttachmentsReturn {
    const opts: Required<AttachmentOptions> = { ...DEFAULT_OPTIONS, ...options };

    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Process and add files
     */
    const addFiles = useCallback(async (files: FileList): Promise<AddFilesResult> => {
        const fileArray = Array.from(files);

        // Check max files limit
        if (attachments.length + fileArray.length > opts.maxFiles) {
            console.warn(`⚠️ Maximum ${opts.maxFiles} files allowed`);
            return { success: false, error: `Maximum ${opts.maxFiles} files allowed` };
        }

        setIsProcessing(true);
        const newAttachments: Attachment[] = [];
        const errors: string[] = [];

        for (const file of fileArray) {
            const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Check file type
            if (!isAllowedType(file)) {
                errors.push(`${file.name}: File type not allowed`);
                continue;
            }

            // Check file size before processing
            if (file.size > opts.maxFileSize * 2) {  // Allow 2x for pre-compression
                errors.push(`${file.name}: File too large (max ${formatFileSize(opts.maxFileSize)})`);
                continue;
            }

            try {
                let base64: string;
                let preview: string | undefined;

                if (IMAGE_TYPES.includes(file.type) && opts.compressImages) {
                    // Compress image
                    const result = await compressImage(file, opts.imageQuality, opts.maxImageDimension);
                    base64 = result.base64;
                    preview = result.preview;
                } else {
                    // Read file as-is
                    base64 = await readFileAsBase64(file);
                    if (IMAGE_TYPES.includes(file.type)) {
                        preview = base64; // Use full image as preview for uncompressed
                    }
                }

                // Check final size after compression
                const finalSize = base64.length * 0.75;  // Base64 is ~33% larger than binary
                if (finalSize > opts.maxFileSize) {
                    errors.push(`${file.name}: File too large after processing (${formatFileSize(finalSize)})`);
                    continue;
                }

                newAttachments.push({
                    id,
                    file,
                    name: file.name,
                    type: file.type,
                    size: finalSize,
                    preview,
                    base64
                });

                console.log(`📎 Attachment added: ${file.name} (${formatFileSize(finalSize)})`);
            } catch (error) {
                console.error(`Failed to process ${file.name}:`, error);
                errors.push(`${file.name}: Failed to process file`);
            }
        }

        setAttachments(prev => [...prev, ...newAttachments]);
        setIsProcessing(false);

        if (errors.length > 0) {
            return { success: false, error: errors.join('\n'), added: newAttachments.length };
        }
        return { success: true, added: newAttachments.length };
    }, [attachments.length, opts]);

    /**
     * Remove an attachment by ID
     */
    const removeAttachment = useCallback((id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
        console.log(`🗑️ Attachment removed: ${id}`);
    }, []);

    /**
     * Clear all attachments
     */
    const clearAttachments = useCallback(() => {
        setAttachments([]);
        console.log('🗑️ All attachments cleared');
    }, []);

    /**
     * Get attachments formatted for Direct Line
     */
    const getDirectLineAttachments = useCallback((): DirectLineAttachment[] => {
        return attachments
            .filter(a => a.base64)  // Only include attachments with base64 data
            .map(a => ({
                contentType: a.type,
                contentUrl: a.base64!,  // We've filtered so this is safe
                name: a.name
            }));
    }, [attachments]);

    /**
     * Open file picker
     */
    const openFilePicker = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, []);

    /**
     * Get accept string for file input
     */
    const getAcceptString = useCallback(() => {
        return Object.keys(ALLOWED_TYPES).join(',');
    }, []);

    return {
        attachments,
        isProcessing,
        addFiles,
        removeAttachment,
        clearAttachments,
        getDirectLineAttachments,
        openFilePicker,
        fileInputRef,
        getAcceptString,
        hasAttachments: attachments.length > 0,
        totalSize: attachments.reduce((sum, a) => sum + a.size, 0)
    };
}
