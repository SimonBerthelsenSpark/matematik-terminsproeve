import { useState } from 'react';

export function useFileHandling(getAllFilesFromEntry, setDocuments, setError) {
    const [dragStates, setDragStates] = useState({
        rettevejledning: false,
        omsætningstabel: false,
        elevbesvarelser: false
    });

    const handleFileUpload = (type, event) => {
        const files = Array.from(event.target.files);
        if (type === 'elevbesvarelser') {
            setDocuments(prev => ({ ...prev, elevbesvarelser: [...prev.elevbesvarelser, ...files] }));
        } else {
            setDocuments(prev => ({ ...prev, [type]: files[0] }));
        }
        setError(null);
    };

    const handleDragOver = (type, e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragStates(prev => ({ ...prev, [type]: true }));
    };

    const handleDragLeave = (type, e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragStates(prev => ({ ...prev, [type]: false }));
    };

    const handleDrop = async (type, e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragStates(prev => ({ ...prev, [type]: false }));
        
        const files = [];
        const items = e.dataTransfer.items;
        
        if (items) {
            const filePromises = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                    if (entry) {
                        filePromises.push(getAllFilesFromEntry(entry));
                    } else {
                        const file = item.getAsFile();
                        if (file) files.push(file);
                    }
                }
            }
            const nestedFiles = await Promise.all(filePromises);
            nestedFiles.forEach(fileList => files.push(...fileList));
        } else {
            files.push(...Array.from(e.dataTransfer.files));
        }
        
        if (files.length === 0) return;
        
        const validExtensions = ['pdf', 'docx', 'txt'];
        const validFiles = files.filter(file => validExtensions.includes(file.name.split('.').pop().toLowerCase()));
        const invalidFiles = files.filter(file => !validExtensions.includes(file.name.split('.').pop().toLowerCase()));
        
        if (invalidFiles.length > 0) {
            console.warn('Ignorerede filer:', invalidFiles.map(f => f.name));
            if (validFiles.length === 0) {
                setError('Ingen gyldige filer fundet. Kun PDF, DOCX og TXT.');
                return;
            }
        }
        
        if (type === 'elevbesvarelser') {
            setDocuments(prev => ({ ...prev, elevbesvarelser: [...prev.elevbesvarelser, ...validFiles] }));
            if (validFiles.length > 0) setError(null);
        } else {
            if (validFiles.length > 1) {
                setError(`Du kan kun uploade én fil for ${type}`);
                return;
            }
            setDocuments(prev => ({ ...prev, [type]: validFiles[0] }));
            setError(null);
        }
    };

    const removeFile = (type, index = null) => {
        if (type === 'elevbesvarelser' && index !== null) {
            setDocuments(prev => ({ ...prev, elevbesvarelser: prev.elevbesvarelser.filter((_, i) => i !== index) }));
        } else {
            setDocuments(prev => ({ ...prev, [type]: null }));
        }
    };

    return {
        dragStates,
        handleFileUpload,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        removeFile
    };
}
