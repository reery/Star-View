# Milky Way panorama attribution

“The Milky Way panorama” by ESO/S. Brunier.

- Source: https://www.eso.org/public/images/eso0932a/
- License: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/
- Download: https://cdn.eso.org/images/large/eso0932a.jpg (6000×3000 pixels).
- Changes: resized from the higher-resolution source to 5120×2560 pixels. `milky-way.avif` is the delivered texture: Lanczos-3 resize of the 6000×3000 download, AVIF quality 70, 8-bit 4:2:0 (libaom via sharp 0.35, effort 6). `milky-way.jpg` is the earlier JPEG derivative of the same source, kept for browsers without AVIF support. Against the resized source, the AVIF measures 38.42 dB PSNR and 0.9954 mean SSIM; the JPEG measures 35.05 dB and 0.9952. At render time, the panorama is dimmed, fine star peaks are slightly reduced, and saturation is boosted in exaggerated color mode.
