/**
 * AttachmentPreview - Displays attachment previews before sending
 */

import React from 'react';
import { Attachment, getFileIcon, formatFileSize } from './useAttachments';

export interface AttachmentPreviewProps {
    attachments: Attachment[];
    onRemove: (id: string) => void;
    isProcessing?: boolean;
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
    attachments,
    onRemove,
    isProcessing = false
}) => {
    if (attachments.length === 0 && !isProcessing) {
        return null;
    }

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '8px 12px',
                borderTop: '1px solid #e1dfdd',
                backgroundColor: '#faf9f8',
                maxHeight: '150px',
                overflowY: 'auto'
            }}
        >
            {isProcessing && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        border: '1px solid #e1dfdd',
                        fontSize: '13px',
                        color: '#605e5c'
                    }}
                >
                    <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                    Processing...
                </div>
            )}

            {attachments.map(attachment => (
                <div
                    key={attachment.id}
                    style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '8px',
                        backgroundColor: '#fff',
                        borderRadius: '6px',
                        border: '1px solid #e1dfdd',
                        minWidth: '80px',
                        maxWidth: '100px'
                    }}
                >
                    {/* Remove button */}
                    <button
                        onClick={() => onRemove(attachment.id)}
                        style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#d13438',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            lineHeight: 1
                        }}
                        title="Remove attachment"
                    >
                        ×
                    </button>

                    {/* Preview */}
                    {attachment.preview ? (
                        <img
                            src={attachment.preview}
                            alt={attachment.name}
                            style={{
                                width: '60px',
                                height: '60px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                backgroundColor: '#f3f2f1'
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: '60px',
                                height: '60px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '28px',
                                backgroundColor: '#f3f2f1',
                                borderRadius: '4px'
                            }}
                        >
                            {getFileIcon(attachment.type)}
                        </div>
                    )}

                    {/* File name */}
                    <div
                        style={{
                            marginTop: '4px',
                            fontSize: '11px',
                            color: '#323130',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%',
                            maxWidth: '80px'
                        }}
                        title={attachment.name}
                    >
                        {attachment.name.length > 12
                            ? attachment.name.substring(0, 10) + '...'
                            : attachment.name}
                    </div>

                    {/* File size */}
                    <div
                        style={{
                            fontSize: '10px',
                            color: '#605e5c'
                        }}
                    >
                        {formatFileSize(attachment.size)}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AttachmentPreview;
