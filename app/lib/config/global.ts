/**
 * global.ts — Config partagée par toutes les scènes
 */

export const GLOBAL_CONFIG = {

  MIN_SIZE: {
    width:  600,
    height: 450,
  },

  ARROW: {
    size_vh:   7,
    size_min: 36,
    size_max: 120,
  },

  TORCH: {
    lag:  0.068,
  },

  TRANSITION: {
    veil_in:   700,
    veil_hold: 120,
    veil_out:  900,
  },

  TITLE: {
    texte:       ['Abounaddara', '—', 'CNRS', '—', '2026'],
    couleur:     'rgba(210,175,90,1)',
    char_delay:  65,
    start_delay: 800,
  },

  TITLE_SWAP_MS: 620,

  AUDIO: {
    musee_vol:         1.0,
    musee_fade:        2500,
    phren_fade_in:     1800,
    phren_fade_out:    2200,
    phren_intro_delay: 1800,
    sanza_vol:         0.65,
    sanza_fade_in:     2000,
    sanza_fade_out:    1200,
    silence_vol:       0.75,
    silence_fade_in:   1200,
    silence_fade_out:  1800,
    collab_vol:        1.0,
    collab_fade_in:    2500,
    collab_fade_out:   2000,
  },

  FONTS: {
    title: {
      family:   'Cinzel, serif',
      size_vw:   1.1,
      size_min:  9,
      size_max: 18,
      weight:   400,
      spacing:  '0.30em',
      style:    'normal',
      color:    'rgba(210,175,90,1)',
    },
    subtitle: {
      family:   'Cinzel, serif',
      size_vw:   0.75,
      size_min:  7,
      size_max: 13,
      weight:   400,
      spacing:  '0.18em',
      style:    'normal',
      color:    'rgba(210,175,90,0.78)',
    },
    doc_btns: {
      family:   'Cinzel, serif',
      size_vw:   0.80,
      size_min:  8,
      size_max: 14,
      weight:   400,
      spacing:  '0.18em',
      style:    'normal',
    },
    nav_btns: {
      family:   'Cinzel, serif',
      size_vw:   1.20,
      size_min: 12,
      size_max: 26,
      weight:   300,
      spacing:  '0.18em',
      style:    'normal',
    },
    roman: {
      family:   'Cinzel, serif',
      size_vw:   1.6,
      size_min: 10,
      size_max: 28,
      weight:   600,
      spacing:  '0.08em',
      style:    'normal',
    },
    hover_title: {
      family:   'Playfair Display, Cormorant Garamond, Georgia, serif',
      size_vw:   2.0,
      size_min: 14,
      size_max: 36,
      weight:   300,
      spacing:  '0.06em',
      style:    'italic',
      color:    'rgba(255,255,255,0.82)',
    },
  },

  PLAYER: {
    audio_w:                 0.62,
    audio_h:                 0.16,
    audio_bg_opacity:        0.35,
    wave_color:              'rgba(255,255,255,0.75)',
    wave_width:               1.5,
    audio_wave_h:            0.62,
    audio_wave_gap:          0.08,
    video_ratio:             0.95,
    video_bg_opacity:        0.75,
    video_min_w:             0.30,
    video_max_w:             0.80,
    video_scale_duration_ms:  700,
    video_scale_ease_power:   3.5,
    video_seek_h:            0.12,
    video_seek_thick:         1.2,
    media_inset:             0.0005,
    video_ctrl_h:            0.14,
    stroke:                  'rgba(255,255,255,0.85)',
    draw_speed:               0.9,
    fade_out_ms:              950,
    fade_out_y:               18,
    btn_color:               'rgba(255,255,255,0.82)',
    btn_color_hover:         'rgba(255,220,120,1)',
    close_size:               0.028,
    close_delay:              0.5,
    torch_dim:                0.8,
    torch_ms:                 800,
  },

  START_SCREEN: {
    fadeOut: 1200,
  },

} as const