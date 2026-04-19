import type { Hotspot } from '@/app/lib/types'

const R2 = 'https://pub-8938d1ea3c9c462b86b84c096097c9ba.r2.dev'

export const CHAPITRE2_CONFIG = {
  subtitle: 'Pourquoi Soliman el&#8209;Halabi aurait&#8209;il tué Kléber\u00a0?',
  debug: false,
  light: {
    intro_frac:       0.90,
    intro_duration:   2200,
    interactive_frac: 0.95,
    trans_duration:   2000,
    media_frac:       0.42,
    media_duration:    800,
  },
  timing: {
    phren_sound_delay: 4000,
    skip_intro_delay:  1000,
    skip_btn_delay:    2000,
  },
  arrow: {
    appear_at:     420,
    draw_duration: 2100,
  },
  hotspots: [
    {
      img:   'chapitre2-1',
      label: 'Langage',
      l: 61, t: 40, w: 28, h: 35,
      media: `${R2}/audios/production/lycee/temoignage/violence_et_histoire_philo/S1-%20pr%C3%A9sentation%20hist%20SH-%201.34.m4a`,
    },
    {
      img:   'chapitre2-2',
      label: '33',
      l: 12, t: 41, w: 29, h: 37,
      media: `${R2}/audios/production/lycee/temoignage/candice/C2.mp3`,
    },
    {
      img:   'chapitre2-3',
      label: 'Éventualité',
      l: 46, t:  0, w: 22, h: 22,
      media: `${R2}/audios/production/lycee/temoignage/violence_et_histoire_philo/S2-reflexion%20sur%20les%20motifs%20de%20l%27acte%20assassinat%20de%20SH-%203.27.m4a`,
    },
    {
      img:   'chapitre2-4',
      label: 'Individualité',
      l: 46, t: 22, w: 19, h: 26,
      media: `${R2}/videos/production/lycee/L%20emprise.mp4`,
    },
    {
      img:   'chapitre2-5',
      label: 'Pesanteur',
      l: 67, t: 18, w: 13, h: 22,
      media: `${R2}/videos/production/lycee/Dans%20notre%20theatre.mp4`,
    },
    {
      img:   'chapitre2-6',
      label: '27',
      l: 21, t:  5, w: 32, h: 23,
      media: `${R2}/videos/production/lycee/le%20defenseur%20chiarra.mp4`,
    },
    {
      img:   'chapitre2-7',
      label: 'Temps',
      l: 72, t:  6, w: 20, h: 17,
      media: `${R2}/videos/production/lycee/le%20silence%20du%20passe.mp4`,
    },
    {
      img:   'chapitre2-8',
      label: '25',
      l: 19, t: 23, w: 11, h: 20,
      media: `${R2}/audios/autre/Klaxon.mp3`,
    },
    {
      img:   'chapitre2-9',
      label: 'Nez',
      l: 38, t: 62, w: 22, h: 22,
      media: `${R2}/audios/production/lycee/temoignage/violence_et_histoire_philo/S3-%20le%20fanatisme%201.40.m4a`,
    },
  ] as Hotspot[],
} as const