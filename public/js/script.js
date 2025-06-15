document.addEventListener('DOMContentLoaded', () => {
    const navToggler = document.querySelector('.nav-toggler');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggler && navMenu) {
        navToggler.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const isExpanded = navMenu.classList.contains('active');
            navToggler.setAttribute('aria-expanded', isExpanded);
            navToggler.classList.toggle('open');
        });
    }

    const tiktokForm = document.querySelector('form[action="/download/tiktok"]');
    const tiktokLoader = document.getElementById('tiktokLoaderContainer');
    const tiktokSlideForm = document.querySelector('form[action="/download/tiktok-slide"]'); // Assuming slide also goes to /download/tiktok
    const tiktokSlideLoader = document.getElementById('tiktokSlideLoaderContainer');


    if (tiktokForm && tiktokLoader) {
        tiktokForm.addEventListener('submit', () => {
            const urlInput = tiktokForm.querySelector('input[name="url"]');
            if (urlInput && urlInput.value.trim() !== '') {
                tiktokLoader.style.display = 'flex';
            }
        });
    }
    
    // If tiktok-slide page has its own form and loader
    const tiktokUrlSlideInput = document.getElementById('tiktokUrlSlide'); // Specific ID for slide page input
    if (tiktokUrlSlideInput) { // Check if we are on tiktok-slide page
        const parentForm = tiktokUrlSlideInput.closest('form');
        if (parentForm && tiktokSlideLoader) {
            parentForm.addEventListener('submit', (e) => {
                if (tiktokUrlSlideInput.value.trim() !== '') {
                    tiktokSlideLoader.style.display = 'flex';
                } else {
                    e.preventDefault(); // Prevent submission if empty
                    alert('Mohon masukkan URL TikTok Slide.');
                }
            });
        }
    }


    const spotifyForm = document.querySelector('form[action="/download/spotify"]');
    const spotifyLoader = document.getElementById('spotifyLoaderContainer');

    if (spotifyForm && spotifyLoader) {
        spotifyForm.addEventListener('submit', (e) => {
            const queryInput = spotifyForm.querySelector('input[name="query"]');
            if (queryInput && queryInput.value.trim() !== '') {
                spotifyLoader.style.display = 'flex';

                const searchItemForms = document.querySelectorAll('.search-item-form');
                if (e.submitter && e.submitter.closest('.search-item-form')) {
                    // Jika submit dari tombol search result, loader mungkin tidak perlu ditampilkan di hero
                    // atau disembunyikan segera jika respons cepat
                }

            } else {
                e.preventDefault();
                alert('Mohon masukkan link lagu atau judul untuk dicari.');
            }
        });
    }
    
    const searchResultForms = document.querySelectorAll('form.search-item-form');
    searchResultForms.forEach(form => {
        form.addEventListener('submit', () => {
            if (spotifyLoader) {
                spotifyLoader.style.display = 'flex';
            }
        });
    });

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) { // Handle bfcache
            if (tiktokLoader) tiktokLoader.style.display = 'none';
            if (tiktokSlideLoader) tiktokSlideLoader.style.display = 'none';
            if (spotifyLoader) spotifyLoader.style.display = 'none';
        }
    });
});