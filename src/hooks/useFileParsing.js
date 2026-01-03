export function useFileParsing() {
    const readFileContent = async (file) => {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pdf') return await extractTextFromPDF(file);
        if (ext === 'docx') return await extractTextFromWord(file);
        if (ext === 'txt') return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Kunne ikke læse filen'));
            reader.readAsText(file);
        });
        if (ext === 'doc') throw new Error(`${file.name} er i gammelt Word format`);
        throw new Error(`${file.name}: Filformat '${ext}' understøttes ikke`);
    };

    const extractTextFromWord = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const result = await window.mammoth.extractRawText({ arrayBuffer: e.target.result });
                    if (!result.value || result.value.trim().length === 0) throw new Error('Ingen tekst fundet');
                    console.log(`📄 Extracted ${result.value.length} chars from Word: ${file.name}`);
                    resolve(result.value.trim());
                } catch (err) {
                    reject(new Error(`Kunne ikke parse Word: ${err.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Kunne ikke læse Word filen'));
            reader.readAsArrayBuffer(file);
        });
    };

    const extractTextFromPDF = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const pdf = await window.pdfjsLib.getDocument({data: new Uint8Array(e.target.result)}).promise;
                    let fullText = '';
                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
                    }
                    console.log(`📄 Extracted ${fullText.length} chars from PDF: ${file.name}`);
                    resolve(fullText.trim());
                } catch (err) {
                    reject(new Error(`Kunne ikke parse PDF: ${err.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Kunne ikke læse PDF'));
            reader.readAsArrayBuffer(file);
        });
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
