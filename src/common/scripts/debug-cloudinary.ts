
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env explicitly
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function debugUpload() {
    console.log('--- START DEBUG CLOUDINARY UPLOAD ---');
    // Hardcoded for debugging because dotenv path resolution was failing
    const CLOUD_URL = 'https://api.cloudinary.com/v1_1/dfdzphroa/image/upload';
    const CLOUD_PRESET = 'medicare-project';

    console.log('URL:', CLOUD_URL);
    console.log('PRESET:', CLOUD_PRESET);

    const base64Content = 'JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXwKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCISAgICA+PgogID4+CiAgL0NvbnRlbnRzIDUgMCBSCj4+CmVuZG9iagoKNCAwIG9iago8PAogIC9UeXBlIC9Gb250CiAgL1N1YnR5cGUgL1R5cGUxCiAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgo+PgplbmRvYmoKCjUgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQKNzAgNTAgVGQKL0YxIDEyIFRmCihIZWxsbywgd29ybGQhKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCgp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDA2MCAwMDAwMCBuIAowMDAwMDAwMTU3IDAwMDAwIG4gCjAwMDAwMDAzMjUgMDAwMDAgbiAKMDAwMDAwMDQxMiAwMDAwMCBuIAp0cmFpbGVyCjw8CiAgL1NpemUgNgogIC9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0NjUKJSVFT0YK';

    const fileDataUri = `data:application/pdf;base64,${base64Content}`;

    try {
        const payload = {
            file: fileDataUri,
            upload_preset: CLOUD_PRESET,
            // Testing SAFE params
            original_filename: 'debug_test_file',
            resource_type: 'auto'
        };

        console.log('Payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(CLOUD_URL, payload);
        console.log('✅ UPLOAD SUCCESS!');
        console.log('Secure URL:', response.data.secure_url);

    } catch (error) {
        console.error('❌ UPLOAD FAILED');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

debugUpload();
