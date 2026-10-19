import { extractPdfText, extractWordText } from '../utils/docLibs.js';

export function useFileParsing() {
    const readFileContent = async (file) => {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pdf') return await extractTextFromPDF(file);
        if (ext === 'docx') return await extractTextFromWord(file);
        if (ext === 'txt') return await file.text();
        if (ext === 'doc') throw new Error(`${file.name} er i gammelt Word format`);
        throw new Error(`${file.name}: Filformat '${ext}' understøttes ikke`);
    };

    const extractTextFromWord = async (file) => {
        try {
            const text = await extractWordText(file);
            if (!text) throw new Error('Ingen tekst fundet');
            return text;
        } catch (err) {
            throw new Error(`Kunne ikke parse Word: ${err.message}`);
        }
    };

    const extractTextFromPDF = async (file) => {
        try {
            return await extractPdfText(file);
        } catch (err) {
            throw new Error(`Kunne ikke parse PDF: ${err.message}`);
        }
    };

    const getAllFilesFromEntry = async (entry) => {
        const files = [];
        if (entry.isFile) {
            return new Promise((resolve) => {
                entry.file((file) => resolve([file]), (error) => { console.error(error); resolve([]); });
            });
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            return new Promise((resolve) => {
                const readEntries = () => {
                    dirReader.readEntries(async (entries) => {
                        if (entries.length === 0) {
                            resolve(files);
                        } else {
                            for (const entry of entries) {
                                files.push(...await getAllFilesFromEntry(entry));
                            }
                            readEntries();
                        }
                    }, (error) => { console.error(error); resolve(files); });
                };
                readEntries();
            });
        }
        return files;
    };

    return {
        readFileContent,
        extractTextFromWord,
        extractTextFromPDF,
        getAllFilesFromEntry
    };
}
