document.addEventListener('DOMContentLoaded', () => {
    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    if (document.querySelector('.animated-title')) {
        tl.from('.animated-title', { opacity: 0, y: -50, duration: 0.8, delay: 0.2 });
    }
    if (document.querySelector('.animated-tagline')) {
        tl.from('.animated-tagline', { opacity: 0, y: -30, duration: 0.7 }, "-=0.5");
    }
    if (document.querySelector('.downloader-form')) {
        tl.from('.downloader-form', { opacity: 0, scale: 0.95, duration: 0.6 }, "-=0.4");
    }
    
    gsap.utils.toArray('.result-card').forEach((card, i) => {
        tl.from(card, { opacity: 0, y: 50, duration: 0.5, stagger: 0.15 }, "-=0.2");
    });
    
    gsap.utils.toArray('.alert:not(.shake)').forEach((alertBox, i) => { // Hindari animasi ulang untuk alert error yg sudah ada
        if (!alertBox.classList.contains('animated')) { // Tambah flag agar tidak re-animasi jika kembali ke halaman
             tl.from(alertBox, { opacity: 0, x: -50, duration: 0.5, stagger: 0.1 }, "-=0.3");
             alertBox.classList.add('animated');
        } else {
            gsap.set(alertBox, {opacity: 1, x: 0}); // Pastikan terlihat jika sudah dianimasikan
        }
    });

    const formInputs = document.querySelectorAll('.downloader-form .form-control');
    formInputs.forEach(input => {
        input.addEventListener('focus', () => {
            gsap.to(input, { boxShadow: "0 0 15px var(--glow-color), 0 0 5px var(--glow-color) inset", duration: 0.3 });
        });
        input.addEventListener('blur', () => {
            gsap.to(input, { boxShadow: "none", duration: 0.3 });
        });
    });

    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            gsap.to(button, { 
                y: -3, 
                scale: 1.03, 
                boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
                duration: 0.2, 
                ease: 'power1.out' 
            });
        });
        button.addEventListener('mouseleave', () => {
            gsap.to(button, { 
                y: 0, 
                scale: 1, 
                boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                duration: 0.2, 
                ease: 'power1.out' 
            });
        });
    });
});