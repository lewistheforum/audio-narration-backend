
import { PDFDocument } from 'pdf-lib';
import axios from 'axios';

async function checkPdfFields() {
    const pdfUrl = 'http://res.cloudinary.com/dfdzphroa/image/upload/v1768839193/medicare-file-pdf/a7vj7ubbttt7onvbwvye.pdf';
    console.log(`Downloading PDF from: ${pdfUrl}`);

    try {
        const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
        const pdfBuffer = response.data;

        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        if (fields.length === 0) {
            console.log('--------------------------------------------------');
            console.log('RESULT: NO FORM FIELDS FOUND.');
            console.log('This looks like a standard PDF (flattened or just text).');
            console.log('To fill data, we must either:');
            console.log('  1. Add fields using Adobe Acrobat/Foxit (Recommended).');
            console.log('  2. Draw text at specific (x, y) coordinates.');
            console.log('--------------------------------------------------');
        } else {
            console.log('--------------------------------------------------');
            console.log(`RESULT: FOUND ${fields.length} FIELDS!`);
            console.log('Field Names:');
            fields.forEach(f => {
                console.log(` - ${f.getName()} (Type: ${f.constructor.name})`);
            });
            console.log('--------------------------------------------------');
        }

    } catch (error) {
        console.error('Error processing PDF:', error.message);
    }
}

checkPdfFields();
