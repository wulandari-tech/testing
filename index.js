const express = require('express');
const axios = require('axios'); // Pastikan sudah install: npm install axios express
const path = require('path'); // <--- PERBAIKAN DI SINI

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk parsing JSON body
app.use(express.json());

// Fungsi tikwm yang sudah diadaptasi
async function tikwm(url) {
    let retries = 0;
    let response;
    const maxRetries = 5; // Mengurangi retries agar tidak terlalu lama jika API bermasalah
    const retryDelay = 3000; // 3 detik

    console.log(`Fetching data for URL: ${url}`);

    while (retries < maxRetries) {
        try {
            response = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000 // 10 detik timeout per request
            }).catch(e => {
                // Tangkap error dari axios, termasuk timeout
                console.error(`Axios error on attempt ${retries + 1}:`, e.message);
                if (e.response) {
                    console.error('Response status:', e.response.status);
                    console.error('Response data:', e.response.data);
                }
                throw e; // Lemparkan kembali agar retry logic berjalan
            });

            if (response && response.data && response.data.code === 0 && response.data.data) {
                console.log('API call successful.');
                return response.data.data;
            } else if (response && response.data && response.data.msg) {
                console.error(`Error from tikwm API: ${response.data.msg}`);
                throw new Error(`API Error: ${response.data.msg}`);
            } else {
                console.error("Unexpected response from tikwm API. Retrying...");
                throw new Error("Unexpected API response from tikwm");
            }
        } catch (error) {
            console.error(`Attempt ${retries + 1} failed for ${url}: ${error.message}`);
            retries++;
            if (retries < maxRetries) {
                console.log(`Retrying in ${retryDelay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            } else {
                console.error(`Max retries reached for ${url}. Giving up.`);
                throw error; // Lemparkan error terakhir setelah semua retries gagal
            }
        }
    }
}

// Endpoint untuk download
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    const tiktokRegex = /https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|[\w.-]+\/video\/\d+|\w+|t\/\w+)/i;

    if (!url || !tiktokRegex.test(url)) {
        return res.status(400).json({ success: false, message: 'URL TikTok tidak valid.' });
    }

    try {
        console.log(`Processing download request for: ${url}`);
        const data = await tikwm(url);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error processing TikTok URL:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Gagal mengambil data TikTok. Coba lagi nanti atau link mungkin tidak didukung.' });
    }
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`WFC DOWN server berjalan di http://localhost:${PORT}`);
});