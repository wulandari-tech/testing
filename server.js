const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const { URL } = require('url');
const cheerio = require('cheerio');
const MongoStore = require('connect-mongo');

const app = express();
const PORT = process.env.PORT || 3000;

const mongoUrl = process.env.MONGODB_URI || 'mongodb+srv://zanssxploit:pISqUYgJJDfnLW9b@cluster0.fgram.mongodb.net/daf_db?retryWrites=true&w=majority';
if (!process.env.MONGODB_URI && process.env.NODE_ENV === 'production') {
    console.warn("PERINGATAN: MONGODB_URI tidak diatur untuk lingkungan produksi! Sesi mungkin tidak persisten.");
}

const mongoSessionStore = MongoStore.create({
    mongoUrl: mongoUrl,
    collectionName: 'web_sessions',
    ttl: 14 * 24 * 60 * 60, // 14 hari
    autoRemove: 'native'
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    store: mongoSessionStore,
    secret: process.env.SESSION_SECRET || 'wfcDOWNSecretKeyMongoV1_SuperFixed_GANTI_INI',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 hari
        sameSite: 'lax'
    }
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
        console.error("TikWM Fetch Error:", e.message);
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
        const { data } = await axios.get(`${SPOTIFY_API_BASE}/api/info/track`, { params: { url: trackUrl }, timeout: 15000 });
        if (data && data.title) return data;
        throw new Error(data?.message || "Spotify API Info Error");
    } catch (e) {
        console.error("Spotify Info Error:", e.message);
        throw new Error(`Spotify Info Error: ${e.message}`);
    }
}

async function spotifySearchTracks(query) {
    try {
        const { data } = await axios.get(`${SPOTIFY_API_BASE}/api/search/tracks`, { params: { q: query }, timeout: 15000 });
        if (data && Array.isArray(data)) return data;
        throw new Error(data?.message || "Spotify API Search Error");
    } catch (e) {
        console.error("Spotify Search Error:", e.message);
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
            timeout: 25000
        });

        if (data.status !== "ok" || !data.data) throw new Error(data.message || "Gagal mengambil data dari yt5s.io.");
        
        const $ = cheerio.load(data.data);
        let result = { platform: "", type: "", media: null, thumb: null, error: null, title: $("title").text() || "Media Sosial" };

        if (/^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/.+/i.test(url)) {
            result.platform = "facebook";
            result.thumb = $('img').attr("src");
            let links = [];
            $('table tbody tr').each((_, el) => {
                const quality = $(el).find('.video-quality').text().trim();
                const link = $(el).find('a.download-link-fb').attr("href");
                if (quality && link) links.push({ quality, link });
            });
            if (links.length > 0) {
                result.type = "video";
                result.media = links[0].link;
            } else if (result.thumb) {
                result.type = "image";
                result.media = result.thumb;
            } else {
                result.error = "Tidak ada media Facebook yang dapat diunduh dari respons API.";
            }
        } else if (/^(https?:\/\/)?(www\.)?(instagram\.com\/(p|reel|stories)\/).+/i.test(url)) {
            result.platform = "instagram";
            result.thumb = $('img').first().attr("src");
            const videoLink = $('a[href*=".mp4"]').first().attr("href");
            const imageLinkFromATag = $('a[href*=".jpg"], a[href*=".jpeg"]').first().attr("href");
            
            if (videoLink) {
                result.type = "video";
                result.media = videoLink;
            } else if (imageLinkFromATag) {
                result.type = "image";
                result.media = imageLinkFromATag;
            } else if (result.thumb && !$('video').length) {
                result.type = "image";
                result.media = result.thumb;
            } else {
                result.error = "Tidak ada media Instagram yang dapat diunduh dari respons API atau format tidak didukung oleh scraper ini.";
            }
        } else {
            result.error = "URL tidak valid. Gunakan link Facebook atau Instagram.";
        }
        
        if (result.error && !result.media) throw new Error(result.error);
        if (!result.media && !result.error) throw new Error("Media tidak ditemukan setelah parsing.");
        return result;
    } catch (error) {
        console.error("igFbDownloader error:", error.message);
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
        const maxAttempts = 25;

        do {
            if (attempts >= maxAttempts) throw new Error("Timeout saat polling download YouTube, proses terlalu lama.");
            await new Promise(resolve => setTimeout(resolve, 3000));
            try {
                const { data: pollRes } = await axios.get(start.progress_url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                pollingData = pollRes;
            } catch (pollError) {
                console.warn(`Polling attempt ${attempts + 1} for YouTube failed: ${pollError.message}`);
            }
            attempts++;
        } while (!pollingData?.download_url && (pollingData?.progress < 100 || typeof pollingData?.progress === 'undefined'));

        if (!pollingData?.download_url) throw new Error("Gagal mendapatkan link download YouTube setelah polling.");
        
        meta.downloadUrl = pollingData.download_url;
        return meta;
    } catch (error) {
        console.error("youtubeDownloader error:", error.message);
        throw new Error(`Kesalahan saat mengunduh dari YouTube: ${error.message}`);
    }
}

app.get('/', (req, res) => res.render('index', { pageTitle: 'TikTok Video/Foto', navTitle: 'TikTok', tagline: 'Unduh Video & Foto TikTok Tanpa Watermark!' }));
app.get('/tiktok-slide', (req, res) => res.render('tiktok-slide', { pageTitle: 'TikTok Slide', navTitle: 'TikTok Slide', tagline: 'Unduh Semua Gambar dari TikTok Slide!' }));

app.get('/instagram', (req, res) => {
    if (!req.session) return res.status(500).send("Session error.");
    res.render('instagram', {
        pageTitle: 'Instagram Downloader', navTitle: 'Instagram',
        tagline: 'Unduh Video & Foto Instagram!', error: req.session.igError, lastUrl: req.session.lastIgUrl
    });
    delete req.session.igError; delete req.session.lastIgUrl;
});

app.get('/youtube', (req, res) => {
    if (!req.session) return res.status(500).send("Session error.");
    res.render('youtube', {
        pageTitle: 'YouTube Downloader', navTitle: 'YouTube',
        tagline: 'Unduh Video YouTube dengan Kualitas Pilihan!', error: req.session.ytError, lastUrl: req.session.lastYtUrl
    });
    delete req.session.ytError; delete req.session.lastYtUrl;
});

app.get('/spotify', (req, res) => {
    if (!req.session) return res.status(500).send("Session error.");
    const data = { spotifyTrackInfo: req.session.spotifyTrackInfo, spotifySearchResults: req.session.spotifySearchResults, spotifyError: req.session.spotifyError, lastSpotifyQuery: req.session.lastSpotifyQuery };
    delete req.session.spotifyTrackInfo; delete req.session.spotifySearchResults; delete req.session.spotifyError; delete req.session.lastSpotifyQuery;
    res.render('spotify', {
        pageTitle: 'Spotify Downloader', navTitle: 'Spotify', tagline: 'Cari & Unduh Lagu Favoritmu dari Spotify!',
        spotifyTrackInfo: data.spotifyTrackInfo, spotifySearchResults: data.spotifySearchResults,
        spotifyError: data.spotifyError, lastQuery: data.lastSpotifyQuery || ''
    });
});

app.get('/stream/spotify', async (req, res) => {
    const trackUrl = req.query.url;
    if (!trackUrl || !isValidSpotifyTrackUrl(trackUrl)) return res.status(400).send('URL Spotify tidak valid.');
    try {
        const response = await axios.get(`${SPOTIFY_API_BASE}/api/download/track`, {
            params: { url: trackUrl }, responseType: 'stream', timeout: 45000
        });
        res.setHeader('Content-Type', 'audio/mpeg');
        if (req.query.title && req.query.artist) {
            const filename = `${req.query.title.replace(/[^a-zA-Z0-9_]+/g, '_')} - ${req.query.artist.replace(/[^a-zA-Z0-9_]+/g, '_')}.mp3`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        response.data.pipe(res);
        response.data.on('error', (e) => { if (!res.headersSent) res.status(500).send('Stream error.');});
    } catch (e) {
        console.error("Spotify Stream Error:", e.message);
        if (!res.headersSent) res.status(e.response?.status || 500).send(`Stream Gagal: ${e.message}`);
    }
});

app.post('/download/tiktok', async (req, res) => {
    if (!req.session) return res.status(500).redirect('/');
    const { url } = req.body;
    req.session.downloaderType = 'tiktok';
    if (!url || !/tiktok\.com/i.test(url)) {
        req.session.downloadError = 'URL TikTok tidak valid.';
        return res.redirect('/result');
    }
    try {
        req.session.downloadResult = await tikwmFetch(url);
        req.session.downloadError = null;
    } catch (e) {
        req.session.downloadResult = null;
        req.session.downloadError = e.message;
    }
    res.redirect('/result');
});

app.post('/download/instagram', async (req, res) => {
    if (!req.session) return res.status(500).redirect('/');
    const { url } = req.body;
    req.session.lastIgUrl = url;
    req.session.downloaderType = url.includes('instagram.com') ? 'instagram' : 'facebook';

    if (!url || (!/instagram\.com/i.test(url) && !/facebook\.com|fb\.watch/i.test(url))) {
        req.session.downloadError = 'URL Instagram atau Facebook tidak valid.';
        return res.redirect('/result');
    }
    try {
        const result = await igFbDownloader(url);
        req.session.downloadResult = result;
        req.session.downloaderType = result.platform;
        req.session.downloadError = result.error;
    } catch (error) {
        req.session.downloadResult = null;
        req.session.downloadError = error.message;
    }
    res.redirect('/result');
});

app.post('/download/youtube', async (req, res) => {
    if (!req.session) return res.status(500).redirect('/');
    const { url, quality } = req.body;
    req.session.lastYtUrl = url;
    req.session.downloaderType = 'youtube';

    if (!url || !/youtube\.com|youtu\.be/i.test(url)) {
        req.session.downloadError = 'URL YouTube tidak valid.';
        return res.redirect('/result');
    }
    try {
        req.session.downloadResult = await youtubeDownloader(url, quality || '720');
        req.session.downloadError = null;
    } catch (error) {
        req.session.downloadResult = null;
        req.session.downloadError = error.message;
    }
    res.redirect('/result');
});

app.post('/download/spotify', async (req, res) => {
    if (!req.session) return res.status(500).redirect('/');
    const query = req.body.query ? req.body.query.trim() : '';
    req.session.lastSpotifyQuery = query;

    if (!query) {
        req.session.spotifyError = 'Masukkan Link atau Judul Lagu.';
        return res.redirect('/spotify');
    }
    try {
        if (isValidSpotifyTrackUrl(query)) {
            const ti = await spotifyFetchTrackInfo(query);
            req.session.spotifyTrackInfo = {
                title: ti.title, artist: Array.isArray(ti.artists) ? ti.artists.join(', ') : (ti.artist || ti.artists || 'N/A'),
                album: ti.album || 'N/A', thumbnail: ti.thumbnail || ti.cover, url: query, duration: ti.duration || 'N/A',
                streamUrl: `/stream/spotify?url=${encodeURIComponent(query)}&title=${encodeURIComponent(ti.title || 'track')}&artist=${encodeURIComponent(Array.isArray(ti.artists) ? ti.artists.join(', ') : (ti.artist || 'N/A'))}`
            };
            req.session.spotifySearchResults = null; req.session.spotifyError = null;
        } else {
            const sr = await spotifySearchTracks(query);
            if (sr.length === 0) {
                req.session.spotifyError = `Tidak ada hasil untuk "${query}".`;
                req.session.spotifySearchResults = [];
            } else {
                req.session.spotifySearchResults = sr.map(t => ({
                    title: t.title, artist: Array.isArray(t.artists) ? t.artists.join(', ') : (t.artist || t.artists || 'N/A'),
                    thumbnail: t.thumbnail || t.cover, url: t.url
                })).slice(0, 10);
                req.session.spotifyError = null;
            }
            req.session.spotifyTrackInfo = null;
        }
    } catch (e) {
        req.session.spotifyError = e.message;
        req.session.spotifyTrackInfo = null;
        req.session.spotifySearchResults = null;
    }
    res.redirect('/spotify');
});

app.get('/result', (req, res) => {
    if (!req.session) return res.status(500).send("Session error.");
    const data = { downloadResult: req.session.downloadResult, downloadError: req.session.downloadError, downloaderType: req.session.downloaderType };
    delete req.session.downloadResult; delete req.session.downloadError; delete req.session.downloaderType;
    res.render('result', {
        pageTitle: data.downloadError ? 'Kesalahan' : 'Hasil Unduhan', navTitle: 'Hasil',
        results: data.downloadResult, error: data.downloadError, type: data.downloaderType || 'unknown'
    });
});

app.use((req, res) => res.status(404).render('result', { pageTitle: '404 Tidak Ditemukan', navTitle: 'Error', results: null, error: 'Halaman yang Anda cari tidak dapat ditemukan (404).', type: 'error' }));

app.use((err, req, res, next) => {
    console.error("Global Error Handler:", err.stack);
    res.status(500).render('result', { pageTitle: '500 Kesalahan Server', navTitle: 'Error', results: null, error: 'Maaf, terjadi kesalahan internal pada server (500). Coba lagi nanti.', type: 'error' });
});

app.listen(PORT, () => console.log(`Server WFC berjalan di port ${PORT}`));