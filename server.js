const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'wAnZ0fC_sEcReT_d0wNl0aDeR!',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 }
}));

async function tikwmFetch(url) {
    try {
        const response = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            timeout: 20000
        });
        if (response.data && response.data.code === 0 && response.data.data) {
            const d = response.data.data;
            const enrich = (p) => (p && p.startsWith('/')) ? 'https://tikwm.com' + p : p;
            d.play = enrich(d.play);
            d.hdplay = enrich(d.hdplay);
            d.music = enrich(d.music);
            if (d.cover && d.cover.startsWith('//')) d.cover = 'https:' + d.cover; else d.cover = enrich(d.cover);
            if (d.images) d.images = d.images.map(i => (i && i.startsWith('//')) ? 'https:' + i : enrich(i));
            if (d.author && d.author.avatar) if (d.author.avatar.startsWith('//')) d.author.avatar = 'https:' + d.author.avatar; else d.author.avatar = enrich(d.author.avatar);
            if (d.music_info && d.music_info.cover) if (d.music_info.cover.startsWith('//')) d.music_info.cover = 'https:' + d.music_info.cover; else d.music_info.cover = enrich(d.music_info.cover);
            return d;
        } else {
            throw new Error(response.data?.msg || "API TikWM Error");
        }
    } catch (e) {
        throw new Error(`TikWM Fetch Error: ${e.message}`);
    }
}

const SPOTIFY_API_BASE = 'https://spotifyapi.caliphdev.com';

function isValidSpotifyTrackUrl(url) {
    if (!url) return false;
    try {
        const p = new URL(url);
        return p.hostname === 'open.spotify.com' && p.pathname.includes('/track/');
    } catch { return false; }
}

async function spotifyFetchTrackInfo(trackUrl) {
    try {
        const { data } = await axios.get(`${SPOTIFY_API_BASE}/api/info/track`, { params: { url: trackUrl }, timeout: 10000 });
        if (data && data.title) return data;
        throw new Error(data?.message || "Spotify API Info Error");
    } catch (e) {
        throw new Error(`Spotify Info Error: ${e.message}`);
    }
}

async function spotifySearchTracks(query) {
    try {
        const { data } = await axios.get(`${SPOTIFY_API_BASE}/api/search/tracks`, { params: { q: query }, timeout: 10000 });
        if (data && Array.isArray(data)) return data;
        throw new Error(data?.message || "Spotify API Search Error");
    } catch (e) {
        throw new Error(`Spotify Search Error: ${e.message}`);
    }
}

async function igFbDownloader(url) {
    try {
        const form = new URLSearchParams();
        form.append("q", url);
        form.append("vt", "home");

        const { data } = await axios.post('https://yt5s.io/api/ajaxSearch', form, {
            headers: {
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: 20000
        });

        if (data.status !== "ok" || !data.data) throw new Error(data.message || "Gagal mengambil data dari yt5s.io.");
        
        const $ = cheerio.load(data.data);
        let result = { platform: "", type: "", media: null, thumb: null, error: null, title: $("div.media-heading").text().trim() || "Media"};

        if (/^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/.+/i.test(url)) {
            result.platform = "facebook";
            result.thumb = $('img').attr("src");
            let links = [];
            $('table tbody tr').each((_, el) => {
                const quality = $(el).find('td:nth-child(1)').text().trim();
                const link = $(el).find('a.btn-download').attr("href");
                if (quality && link) links.push({ quality, link });
            });
            if (links.length > 0) {
                result.type = "video";
                result.media = links[0].link; 
            } else if (result.thumb) { 
                result.type = "image";
                result.media = result.thumb;
            } else {
                result.error = "Tidak ada media Facebook yang dapat diunduh.";
            }
        } else if (/^(https?:\/\/)?(www\.)?(instagram\.com\/(p|reel|stories)\/).+/i.test(url)) {
            result.platform = "instagram";
            result.thumb = $('div.thumbnail img').attr("src");
            let mediaLinks = [];
            $('div.media-content a.btn-download').each((i, elem) => {
                const href = $(elem).attr('href');
                if (href) mediaLinks.push(href);
            });
            
            if (mediaLinks.length > 0) {
                result.media = mediaLinks; 
                result.type = mediaLinks[0].includes('.mp4') ? "video" : "image";
                if (mediaLinks.length > 1) result.type = "carousel";
            } else {
                 result.error = "Tidak ada media Instagram yang dapat diunduh.";
            }

        } else {
            result.error = "URL tidak valid. Gunakan link Facebook atau Instagram.";
        }
        
        if (result.error && !result.media) throw new Error(result.error);
        if (!result.media) throw new Error("Media tidak ditemukan setelah parsing.");

        return result;
    } catch (error) {
        throw new Error(`Kesalahan saat mengunduh dari Instagram/Facebook: ${error.message}`);
    }
}


async function youtubeDownloader(url, quality = '720') {
    const qualityMap = { "360": 360, "480": 480, "720": 720, "1080": 1080 };
    if (!qualityMap[quality]) throw new Error("Kualitas video YouTube tidak valid.");

    try {
        const { data: start } = await axios.get(
            `https://p.oceansaver.in/ajax/download.php?button=1&start=1&end=1&format=${qualityMap[quality]}&iframe_source=https://allinonetools.com/&url=${encodeURIComponent(url)}`,
            { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } }
        );

        if (!start.progress_url) throw new Error("Gagal memulai proses download YouTube (tidak ada progress_url).");
        
        let meta = {
            image: start.info?.image || "https://via.placeholder.com/300x200.png?text=YouTube+Video",
            title: start.info?.title || "Video YouTube Tidak Diketahui",
            downloadUrl: "",
            quality: quality,
            type: "video",
            platform: "youtube"
        };

        let pollingData, attempts = 0;
        const maxAttempts = 15; 

        do {
            if (attempts >= maxAttempts) throw new Error("Timeout saat polling download YouTube, proses terlalu lama.");
            await new Promise(resolve => setTimeout(resolve, 3000)); 
            try {
                const { data: pollRes } = await axios.get(start.progress_url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                pollingData = pollRes;
            } catch (pollError) {
            }
            attempts++;
        } while (!pollingData?.download_url && (pollingData?.progress < 100 || !pollingData?.progress)); 

        if (!pollingData?.download_url) throw new Error("Gagal mendapatkan link download YouTube setelah polling.");
        
        meta.downloadUrl = pollingData.download_url;
        return meta;

    } catch (error) {
        throw new Error(`Kesalahan saat mengunduh dari YouTube: ${error.message}`);
    }
}


app.get('/', (req, res) => res.render('index', { pageTitle: 'TikTok Video/Foto', navTitle: 'TikTok', tagline: 'Unduh Video & Foto TikTok Tanpa Watermark!', currentPath: '/' }));
app.get('/tiktok-slide', (req, res) => res.render('tiktok-slide', { pageTitle: 'TikTok Slide', navTitle: 'TikTok Slide', tagline: 'Unduh Semua Gambar dari TikTok Slide!', currentPath: '/tiktok-slide' }));

app.get('/spotify', (req, res) => {
    const data = { ...req.session };
    delete req.session.spotifyTrackInfo; delete req.session.spotifySearchResults; delete req.session.spotifyError; delete req.session.lastSpotifyQuery;
    res.render('spotify', {
        pageTitle: 'Spotify Downloader', navTitle: 'Spotify', tagline: 'Cari & Unduh Lagu Favoritmu dari Spotify!',
        spotifyTrackInfo: data.spotifyTrackInfo, spotifySearchResults: data.spotifySearchResults,
        spotifyError: data.spotifyError, lastQuery: data.lastSpotifyQuery || '', currentPath: '/spotify'
    });
});

app.get('/instagram', (req, res) => {
    res.render('instagram', {
        pageTitle: 'Instagram & Facebook Downloader', navTitle: 'Instagram / Facebook',
        tagline: 'Unduh Video & Foto Instagram / Facebook!', error: req.session.igError, lastUrl: req.session.lastIgUrl, currentPath: '/instagram'
    });
    delete req.session.igError; delete req.session.lastIgUrl;
});

app.get('/youtube', (req, res) => {
    res.render('youtube', { 
        pageTitle: 'YouTube Downloader', navTitle: 'YouTube',
        tagline: 'Unduh Video YouTube dengan Kualitas Pilihan!', error: req.session.ytError, lastUrl: req.session.lastYtUrl, currentPath: '/youtube'
    });
    delete req.session.ytError; delete req.session.lastYtUrl;
});


app.get('/stream/spotify', async (req, res) => {
    const trackUrl = req.query.url;
    if (!trackUrl || !isValidSpotifyTrackUrl(trackUrl)) return res.status(400).send('URL Spotify tidak valid.');
    try {
        const response = await axios.get(`${SPOTIFY_API_BASE}/api/download/track`, {
            params: { url: trackUrl }, responseType: 'stream', timeout: 60000 
        });
        res.setHeader('Content-Type', 'audio/mpeg');
        if (req.query.title && req.query.artist) {
            const filename = `${req.query.title.replace(/[^a-zA-Z0-9_]+/g, '_')} - ${req.query.artist.replace(/[^a-zA-Z0-9_]+/g, '_')}.mp3`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        response.data.pipe(res);
        response.data.on('error', (e) => { if (!res.headersSent) res.status(500).send('Stream error.');});
    } catch (e) {
        if (!res.headersSent) res.status(500).send(`Stream Gagal: ${e.message}`);
    }
});

app.post('/download/tiktok', async (req, res) => {
    const { url } = req.body;
    req.session.originalPathBeforeResult = req.headers.referer || '/'; // Ambil dari referer atau default
    if (url && /tiktok\.com\/.*\/photo\//i.test(url) || url && /tiktok\.com\/.*\/slide/i.test(url)) { // Heuristik untuk slide dari URL
        req.session.originalPathBeforeResult = '/tiktok-slide';
    } else {
        req.session.originalPathBeforeResult = '/';
    }

    if (!url || !/tiktok\.com/i.test(url)) {
        req.session.downloadError = 'URL TikTok tidak valid.';
        req.session.downloaderType = 'tiktok';
        return res.redirect('/result');
    }
    try {
        req.session.downloadResult = await tikwmFetch(url);
        req.session.downloaderType = 'tiktok';
    } catch (e) {
        req.session.downloadError = e.message;
        req.session.downloaderType = 'tiktok';
    }
    res.redirect('/result');
});

app.post('/download/spotify', async (req, res) => {
    const query = req.body.query ? req.body.query.trim() : '';
    req.session.lastSpotifyQuery = query;
    req.session.originalPathBeforeResult = '/spotify'; 

    if (!query) {
        req.session.spotifyError = 'Masukkan Link atau Judul Lagu.';
        return res.redirect('/spotify'); // Redirect ke spotify, bukan result, jika error input
    }
    try {
        if (isValidSpotifyTrackUrl(query)) {
            const ti = await spotifyFetchTrackInfo(query);
            req.session.spotifyTrackInfo = {
                title: ti.title, artist: Array.isArray(ti.artists) ? ti.artists.join(', ') : (ti.artist || ti.artists || 'N/A'),
                album: ti.album || 'N/A', thumbnail: ti.thumbnail || ti.cover, url: query, duration: ti.duration || 'N/A',
                streamUrl: `/stream/spotify?url=${encodeURIComponent(query)}&title=${encodeURIComponent(ti.title || 'track')}&artist=${encodeURIComponent(Array.isArray(ti.artists) ? ti.artists.join(', ') : (ti.artist || 'N/A'))}`
            };
        } else {
            const sr = await spotifySearchTracks(query);
            if (sr.length === 0) req.session.spotifyError = `Tidak ada hasil untuk "${query}".`;
            else req.session.spotifySearchResults = sr.map(t => ({
                title: t.title, artist: Array.isArray(t.artists) ? t.artists.join(', ') : (t.artist || t.artists || 'N/A'),
                thumbnail: t.thumbnail || t.cover, url: t.url
            })).slice(0, 10);
        }
    } catch (e) {
        req.session.spotifyError = e.message;
    }
    res.redirect('/spotify'); // Redirect kembali ke halaman spotify untuk menampilkan hasil/error
});

app.post('/download/social', async (req, res) => {
    const { url } = req.body;
    req.session.lastIgUrl = url;
    req.session.originalPathBeforeResult = '/instagram';

    if (!url || (!/instagram\.com/i.test(url) && !/facebook\.com|fb\.watch/i.test(url))) {
        req.session.downloadError = 'URL Instagram atau Facebook tidak valid.';
        req.session.downloaderType = 'social';
        return res.redirect('/result');
    }
    try {
        const result = await igFbDownloader(url);
        req.session.downloadResult = result;
        req.session.downloaderType = result.platform; 
        req.session.downloadError = result.error;
    } catch (error) {
        req.session.downloadResult = null;
        req.session.downloaderType = url.includes('instagram.com') ? 'instagram' : (url.includes('facebook.com') || url.includes('fb.watch') ? 'facebook' : 'social');
        req.session.downloadError = error.message;
    }
    res.redirect('/result');
});

app.post('/download/youtube', async (req, res) => {
    const { url, quality } = req.body;
    req.session.lastYtUrl = url;
    req.session.originalPathBeforeResult = '/youtube';

    if (!url || !/youtube\.com|youtu\.be/i.test(url)) {
        req.session.downloadError = 'URL YouTube tidak valid.';
        req.session.downloaderType = 'youtube';
        return res.redirect('/result');
    }
    try {
        const result = await youtubeDownloader(url, quality || '720');
        req.session.downloadResult = result;
        req.session.downloaderType = 'youtube';
        req.session.downloadError = null;
    } catch (error) {
        req.session.downloadResult = null;
        req.session.downloaderType = 'youtube';
        req.session.downloadError = error.message;
    }
    res.redirect('/result');
});


app.get('/result', (req, res) => {
    const data = { ...req.session };
    // Ambil previousPath dari session, jika tidak ada, default ke '/'
    const previousPathFromSession = req.session.originalPathBeforeResult || '/';
    
    delete req.session.downloadResult; 
    delete req.session.downloadError; 
    delete req.session.downloaderType; 
    // Jangan hapus originalPathBeforeResult di sini, agar refresh halaman result masih punya path sebelumnya
    // Kita akan hapus jika pengguna kembali ke halaman downloader atau memulai unduhan baru

    res.render('result', {
        pageTitle: data.downloadError ? 'Kesalahan Unduhan' : 'Hasil Unduhan', 
        navTitle: 'Hasil',
        results: data.downloadResult, 
        error: data.downloadError, 
        type: data.downloaderType || 'unknown',
        currentPath: '/result', // currentPath untuk navbar
        previousPath: previousPathFromSession // ini yang akan digunakan di tombol "Coba Lagi"
    });
});

// Middleware untuk membersihkan originalPathBeforeResult jika pengguna navigasi ke halaman non-result
// atau untuk menangkap path terakhir SEBELUM ke result.
app.use((req, res, next) => {
    if (req.originalUrl !== '/result' && !req.originalUrl.startsWith('/stream')) {
        // Jika navigasi ke halaman downloader, simpan pathnya
        // Ini akan ter-overwrite oleh POST handler jika ada submit form
        if (['/', '/tiktok-slide', '/spotify', '/instagram', '/youtube'].includes(req.originalUrl)) {
             req.session.originalPathBeforeResult = req.originalUrl;
        }
    }
    next();
});


app.listen(PORT, () => {
    console.log(`WANZOFC DOWN server running on http://localhost:${PORT}`);
});