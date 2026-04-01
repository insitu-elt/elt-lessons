/**
 * bella-vocab-export.js
 * ─────────────────────────────────────────────────────────────────
 * Shared vocabulary export utility for BELLA lesson pages.
 *
 * Drop this script into any BELLA HTML lesson page. It adds an
 * "Open in Vocabulary Trainer" button to the page footer and handles
 * the sessionStorage handoff that launches the trainer in a new tab
 * with the lesson deck pre-loaded.
 *
 * REQUIREMENTS FOR THE HOST LESSON PAGE
 * ──────────────────────────────────────
 * The page must expose its vocabulary as a JS variable named VOCAB,
 * as an array of objects. The minimum required fields are:
 *
 *   { word, gprp, pos, meaning }
 *
 * Optional fields that will be carried through if present:
 *
 *   example   — an example sentence (enables gap-fill cards)
 *   it        — Italian coach note (HTML string)
 *   fr        — French coach note (HTML string)
 *   es        — Spanish coach note (HTML string)
 *
 * The script also reads optional page-level metadata from:
 *
 *   window.BELLA_LESSON_META = {
 *     title:    string,   // lesson title shown in trainer header
 *     level:    string,   // e.g. "B2"
 *     source:   string,   // e.g. "The Reading Room" or "Picture This"
 *     topic:    string,   // e.g. "Silent Cinema"
 *   }
 *
 * If BELLA_LESSON_META is not defined the script infers what it can
 * from the page <title> element.
 *
 * TRAINER PATH
 * ────────────
 * Set BELLA_TRAINER_PATH below to the relative path from the lesson
 * page to vocabulary-trainer.html. The default assumes both files
 * are in the same /tools/ directory.
 *
 * USAGE
 * ─────
 * 1. Add this script to the lesson page (before </body>):
 *      <script src="../tools/bella-vocab-export.js"></script>
 *
 * 2. The script auto-injects the export button into the footer.
 *    No other changes are needed to the lesson page.
 *
 * 3. When the student clicks the button, the deck is written to
 *    sessionStorage and the trainer opens in a new tab, reads the
 *    deck, and starts immediately.
 *
 * SESSIONSSTORAGE KEY
 * ───────────────────
 * Key:   'bella-trainer-deck'
 * Value: JSON string — see BellaTrainerDeck schema below.
 *
 * The trainer clears this key after reading it, so a stale deck
 * never pre-loads on a subsequent visit to the trainer directly.
 * ─────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────── */
  const BELLA_TRAINER_PATH = '../../tools/vocabulary-trainer.html';

  /* ── Colour tokens matching BELLA house style ────────────────── */
  const STYLE = `
    .bella-export-bar {
      display: block;
      width: 100%;
      margin-top: 14px;
      text-align: center;
    }
    .bella-export-btn {
      display: inline-block;
      background: #B8963E;
      color: #0D1B2A;
      border: none;
      padding: 9px 22px;
      border-radius: 4px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      text-decoration: none;
      vertical-align: middle;
    }
    .bella-export-btn:hover {
      background: #D4AE58;
      transform: translateY(-1px);
    }
    .bella-export-btn:active {
      transform: translateY(0);
    }
    .bella-export-confirm {
      display: block;
      font-size: 0.78rem;
      color: #2D6A4F;
      letter-spacing: 0.06em;
      margin-top: 6px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .bella-export-confirm.visible {
      opacity: 1;
    }
  `;

  /* ── Helpers ─────────────────────────────────────────────────── */

  /**
   * Strip HTML tags from a coach note string so we get clean plain
   * text for the L1 definition field. The full HTML is preserved
   * separately for the coach panel.
   */
  function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract the primary L1 translation from an Italian coach note.
   * The note format is typically:
   *   "🇮🇹 <i>parola italiana</i> — explanation..."
   * We want just the Italian word(s) before the dash.
   */
  function extractL1Gloss(itNote) {
    if (!itNote) return '';
    // Strip HTML first
    const plain = stripHtml(itNote);
    // Remove the flag emoji prefix
    const withoutFlag = plain.replace(/^[\u{1F1E0}-\u{1F1FF}]{2}\s*/u, '').trim();
    // Take everything before the first em-dash or regular dash
    const beforeDash = withoutFlag.split(/\s*[—–-]\s*/)[0].trim();
    return beforeDash;
  }

  /**
   * Build the BellaTrainerDeck object from the page's VOCAB array.
   *
   * BellaTrainerDeck schema:
   * {
   *   meta: {
   *     title:   string,
   *     level:   string,
   *     source:  string,
   *     topic:   string,
   *     exportedAt: ISO string,
   *   },
   *   cards: [
   *     {
   *       word:        string,   // required
   *       gprp:        string,   // pronunciation respelling
   *       pos:         string,   // part of speech
   *       def:         string,   // English definition (from 'meaning')
   *       example:     string,   // example sentence (optional)
   *       l1_def:      string,   // L1 gloss extracted from 'it' note
   *       coach_it:    string,   // full Italian coach note (HTML)
   *       coach_fr:    string,   // full French coach note (HTML)
   *       coach_es:    string,   // full Spanish coach note (HTML)
   *       // Future fields (populated later by word-list lookup):
   *       // ngsl_tier, awl_sublist, oxford_band, topic_tag, word_forms[]
   *     }
   *   ]
   * }
   */
  function buildDeck() {
    if (typeof VOCAB === 'undefined' || !Array.isArray(VOCAB) || VOCAB.length === 0) {
      return null;
    }

    // Read page-level metadata
    const meta = (typeof BELLA_LESSON_META !== 'undefined' && BELLA_LESSON_META)
      ? BELLA_LESSON_META
      : {};

    // Infer title from <title> if not set
    const pageTitle = document.title.replace(/\s*[·—\-]\s*BELLA.*$/i, '').trim();

    const deckMeta = {
      title:      meta.title  || pageTitle || 'BELLA Lesson',
      level:      meta.level  || '',
      source:     meta.source || '',
      topic:      meta.topic  || '',
      exportedAt: new Date().toISOString(),
    };

    const cards = VOCAB.map(function (v) {
      return {
        word:     v.word     || '',
        gprp:     v.gprp     || '',
        pos:      v.pos      || '',
        def:      v.meaning  || v.def || '',
        example:  v.example  || '',
        l1_def:   extractL1Gloss(v.it || ''),
        coach_it: v.it       || '',
        coach_fr: v.fr       || '',
        coach_es: v.es       || '',
      };
    });

    return { meta: deckMeta, cards: cards };
  }

  /* ── Export action ───────────────────────────────────────────── */

  function exportToTrainer(confirmEl) {
    const deck = buildDeck();
    if (!deck) {
      alert('No vocabulary found on this page. Is the VOCAB array defined?');
      return;
    }

    try {
      sessionStorage.setItem('bella-trainer-deck', JSON.stringify(deck));
    } catch (e) {
      // sessionStorage full or unavailable — fall back to a notice
      alert('Could not write to session storage. Please check your browser settings.');
      return;
    }

    // Show brief confirmation before opening new tab
    if (confirmEl) {
      confirmEl.classList.add('visible');
      setTimeout(function () { confirmEl.classList.remove('visible'); }, 2500);
    }

    // Open trainer in new tab
    window.open(BELLA_TRAINER_PATH, '_blank');
  }

  /* ── Button injection ────────────────────────────────────────── */

  function injectButton() {
    // Validate VOCAB is present before injecting anything
    if (typeof VOCAB === 'undefined' || !Array.isArray(VOCAB) || VOCAB.length === 0) {
      return;
    }

    const count = VOCAB.length;

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    // Build button bar
    const bar = document.createElement('div');
    bar.className = 'bella-export-bar';

    const btn = document.createElement('button');
    btn.className = 'bella-export-btn';
    btn.textContent = 'Open ' + count + ' words in Vocabulary Trainer';
    btn.setAttribute('aria-label', 'Open lesson vocabulary in the BELLA Vocabulary Trainer');

    const confirmMsg = document.createElement('span');
    confirmMsg.className = 'bella-export-confirm';
    confirmMsg.textContent = '✓ Deck loaded — launching trainer…';

    btn.addEventListener('click', function () {
      exportToTrainer(confirmMsg);
    });

    bar.appendChild(btn);
    bar.appendChild(confirmMsg);

    // Find the footer and append there; fall back to body
    const footer = document.querySelector('.site-footer, footer');
    if (footer) {
      footer.appendChild(bar);
    } else {
      document.body.appendChild(bar);
    }
  }

  /* ── Init ────────────────────────────────────────────────────── */

  // Run after the page has fully loaded so VOCAB is guaranteed to exist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }

})();
