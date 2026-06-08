import { animate, stagger } from 'animejs'

/**
 * Hero title words stagger in on mount.
 */
export function animateHeroTitle() {
  const words = document.querySelectorAll('.hero-title-word')
  if (!words.length) return

  animate(words, {
    translateY: [40, 0],
    opacity: [0, 1],
    duration: 700,
    easing: 'easeOutCubic',
    delay: stagger(80, { start: 200 }),
  })
}

/**
 * Hero subtitle fades in after title.
 */
export function animateHeroSubtitle() {
  const els = document.querySelectorAll('.hero-animate-line')
  if (!els.length) return

  animate(els, {
    translateY: [20, 0],
    opacity: [0, 1],
    duration: 600,
    easing: 'easeOutCubic',
    delay: stagger(100, { start: 600 }),
  })
}

/**
 * Hero action buttons stagger in after subtitle.
 */
export function animateHeroActions() {
  const els = document.querySelectorAll('.hero-animate-action')
  if (!els.length) return

  animate(els, {
    translateY: [16, 0],
    opacity: [0, 1],
    duration: 500,
    easing: 'easeOutCubic',
    delay: stagger(60, { start: 900 }),
  })
}

/**
 * Init all hero animations on page load.
 */
export function initAnimations() {
  animateHeroTitle()
  animateHeroSubtitle()
  animateHeroActions()
}
