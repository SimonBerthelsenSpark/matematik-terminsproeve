/**
 * FileUploadZone Component
 * 
 * Håndterer upload af én fil-type (rettevejledning, omsætningstabel, eller elevbesvarelser)
 * Understøtter drag & drop og multi-file upload for elevbesvarelser
 */

import React from 'react';
import { Upload, X, File } from './Icons.jsx';

export function FileUploadZone({
    type,
    title,
    icon: Icon = File,
    file = null,
    files = [],
    onFileChange,
    onRemoveFile,
    dragState = false,
    onDragOver,
    onDragLeave,
    onDrop,
    borderColor = 'indigo',
    multiple = false,
    accept = '.pdf,.docx,.txt'
}) {
    const handleFileInput = (e) => {
        onFileChange(type, e);
    };

    // For single file types
    const singleFile = type !== 'elevbesvarelser' ? file : null;
    // For multiple files (elevbesvarelser)
    const multipleFiles = type === 'elevbesvarelser' ? files : [];

    // Determine count display
    const fileCount = multiple && multipleFiles.length > 0 ? ` (${multipleFiles.length})` : '';

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Icon />
                {title}{fileCount}
            </h3>
            
            <label className="block">
                <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
                        dragState
                            ? `border-${borderColor}-600 bg-${borderColor}-50 scale-105`
                            : `border-${borderColor}-300 hover:border-${borderColor}-500`
                    }`}
                    onDragOver={(e) => onDragOver(type, e)}
                    onDragLeave={(e) => onDragLeave(type, e)}
                    onDrop={(e) => onDrop(type, e)}
                >
                    {singleFile ? (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 truncate flex-1">
                                {singleFile.name}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    onRemoveFile(type);
                                }}
                                className="ml-2 text-red-500 hover:text-red-700"
                            >
                                <X />
                            </button>
                        </div>
                    ) : (
                        <>
                            <Upload />
                            <p className="text-sm text-gray-600 mt-2">
                                {dragState
                                    ? '📥 Slip filen her'
                                    : `Klik eller træk ${multiple ? 'flere ' : ''}PDF/DOCX/TXT her`}
                            </p>
                        </>
                    )}
                    <input
                        type="file"
                        className="hidden"
                        accept={accept}
                        multiple={multiple}
                        onChange={handleFileInput}
                    />
                </div>
            </label>

            {multiple && multipleFiles.length > 0 && (
                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                    {multipleFiles.map((f, idx) => (
                        <div
                            key={idx}
                            className={`flex items-center justify-between bg-${borderColor}-50 p-2 rounded text-sm`}
                        >
                            <span className="text-gray-700 truncate flex-1">{f.name}</span>
                            <button
                                onClick={() => onRemoveFile(type, idx)}
                                className="ml-2 text-red-500 hover:text-red-700"
                            >
                                <X />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
