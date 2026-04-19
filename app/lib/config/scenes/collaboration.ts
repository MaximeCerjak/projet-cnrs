export const COLLABORATION_CONFIG = {
  torch: {
    size:              0.45,
    grow_duration:     3000,
    fade_out_duration: 1500,
  },
  arrow: {
    appear_at:     3000,
    draw_duration: 2100,
  },
  circles: {
    appear_at:        3400,
    appear_at_return: 1500,
    stagger:           320,
    size_vh:            15,
    gap_vh:              8,
    top_pct:            50,
    labels:       ['I', 'II', 'III', 'IV', 'V'],
    hover_titles: [
      'Chapitre 1',
      'Pourquoi Soliman el-Halabi aurait-il tué le général Kléber ?',
      'Chapitre 3',
      'Chapitre 4',
      'Chapitre 5',
    ],
    actions: [null, 'chapitre-2', null, null, null] as (string | null)[],
  },
  audio: {
    fade_out: 2000,
  },
  timing: {
    bg_fade_in:          1200,
    pause_before_torch:   600,
    exit_black_pause:      10,
  },
} as const