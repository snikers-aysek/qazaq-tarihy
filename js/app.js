/**
 * Qazaq Tarihy — Core Application Logic
 * Pure Vanilla JavaScript (No frameworks, no external dependencies)
 * Local-first with safe localStorage wrapper.
 */

(function () {
  'use strict';

  // --- 1. LOCAL STORAGE & STATE MANAGEMENT ---
  const STORAGE_KEY = 'qazaq_tarihy_state_v1';

  let appState = {
    completedLessons: [],
    quizResults: {}, // { [quizId]: { score: number, total: number, date: string } }
    masteredVocab: [],
    bilingualMode: 'bilingual' // 'bilingual' | 'kk' | 'ru'
  };

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        appState = Object.assign(appState, parsed);
      }
    } catch (e) {
      console.warn('LocalStorage unavailable or restricted. Falling back to memory state.', e);
    }
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
    updateGlobalProgress();
  }

  function resetAllProgress() {
    if (confirm('Вы действительно хотите сбросить весь прогресс обучения?')) {
      appState.completedLessons = [];
      appState.quizResults = {};
      appState.masteredVocab = [];
      persistState();
      renderLessonsList();
      renderProgressDashboard();
      alert('Прогресс успешно сброшен!');
    }
  }

  // --- 2. GLOBAL PROGRESS INDICATOR ---
  function updateGlobalProgress() {
    const totalLessons = LESSONS_DATA.length;
    const completedCount = appState.completedLessons.length;
    const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    const bar = document.getElementById('global-progress-bar');
    const label = document.getElementById('global-progress-text');

    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = `${completedCount}/${totalLessons} уроков (${pct}%)`;

    // Update stats cards in progress view if present
    const statLessons = document.getElementById('stat-lessons-count');
    const statVocab = document.getElementById('stat-vocab-count');
    const statAccuracy = document.getElementById('stat-quiz-accuracy');

    if (statLessons) statLessons.textContent = `${completedCount}/${totalLessons}`;
    if (statVocab) statVocab.textContent = appState.masteredVocab.length;

    if (statAccuracy) {
      const keys = Object.keys(appState.quizResults);
      if (keys.length === 0) {
        statAccuracy.textContent = '0%';
      } else {
        let totalScore = 0;
        let totalPossible = 0;
        keys.forEach(k => {
          totalScore += appState.quizResults[k].score;
          totalPossible += appState.quizResults[k].total;
        });
        const acc = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
        statAccuracy.textContent = acc + '%';
      }
    }
  }

  // --- 3. TAB NAVIGATION ---
  function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    const btnBack = document.getElementById('btn-back-to-lessons');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        showLessonsList();
      });
    }

    const btnReset = document.getElementById('btn-reset-progress');
    if (btnReset) {
      btnReset.addEventListener('click', resetAllProgress);
    }
  }

  function switchTab(tabId) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });

    // Update views
    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.add('hidden');
      view.classList.remove('active');
    });

    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) {
      targetView.classList.remove('hidden');
      targetView.classList.add('active');
    }

    // Tab specific render triggers
    if (tabId === 'timeline') {
      renderTimeline('all');
    } else if (tabId === 'vocab') {
      renderVocabularyList('');
    } else if (tabId === 'review-quiz') {
      renderReviewQuiz();
    } else if (tabId === 'progress') {
      renderProgressDashboard();
    } else if (tabId === 'lessons') {
      showLessonsList();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- 4. LESSONS LIST & DETAIL RENDERING ---
  function renderLessonsList() {
    const container = document.getElementById('lessons-cards-grid');
    if (!container) return;

    container.innerHTML = LESSONS_DATA.map(lesson => {
      const isCompleted = appState.completedLessons.includes(lesson.id);
      const quizRes = appState.quizResults[lesson.id];
      const quizBadge = quizRes 
        ? `<span class="card-status completed">Тест: ${quizRes.score}/${quizRes.total}</span>`
        : `<span class="card-status pending">Тест не пройден</span>`;

      return `
        <div class="lesson-card" data-lesson-id="${lesson.id}">
          <div>
            <div class="card-badge-row">
              <span class="card-num">Урок ${lesson.number}</span>
              <span class="card-period">${lesson.period}</span>
              ${quizBadge}
            </div>
            <h3 class="card-title-kk">${lesson.titleKk}</h3>
            <p class="card-title-ru">${lesson.titleRu}</p>
            <p class="card-desc">${lesson.shortDescRu}</p>
          </div>
          <button class="btn-open-lesson" data-lesson-id="${lesson.id}">
            ${isCompleted ? 'Повторить урок →' : 'Начать изучение →'}
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.lesson-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = card.getAttribute('data-lesson-id');
        openLesson(id);
      });
    });
  }

  function showLessonsList() {
    document.getElementById('lessons-list-container').classList.remove('hidden');
    document.getElementById('lesson-detail-container').classList.add('hidden');
    renderLessonsList();
  }

  function openLesson(lessonId) {
    const lesson = LESSONS_DATA.find(l => l.id === lessonId);
    if (!lesson) return;

    document.getElementById('lessons-list-container').classList.add('hidden');
    const detailContainer = document.getElementById('lesson-detail-container');
    detailContainer.classList.remove('hidden');

    const contentArea = document.getElementById('lesson-content-area');
    contentArea.className = `lesson-content-wrapper mode-${appState.bilingualMode}`;

    // Helper to format interactive term links in text
    function enrichKazakhText(text) {
      let enriched = text;
      VOCABULARY_DATA.forEach(v => {
        // Safe regex matching whole words or forms starting with the term stem
        const regex = new RegExp(`\\b(${v.kk})([а-яәіңғүұқөһa-z]*)\\b`, 'gi');
        enriched = enriched.replace(regex, `<span class="term-interactive" data-term-id="${v.id}">$1$2</span>`);
      });
      return enriched;
    }

    // Build paragraphs
    const paragraphsHtml = lesson.paragraphs.map(p => `
      <div class="paragraph-pair">
        <div class="col-kk">
          <span class="lang-label">Қазақша</span>
          <p class="text-kk">${enrichKazakhText(p.kk)}</p>
        </div>
        <div class="col-ru">
          <span class="lang-label">Русский перевод</span>
          <p class="text-ru">${p.ru}</p>
        </div>
      </div>
    `).join('');

    // Build vocabulary section
    const lessonVocab = VOCABULARY_DATA.filter(v => v.lessonId === lesson.id);
    const vocabCardsHtml = lessonVocab.map(v => {
      const isMastered = appState.masteredVocab.includes(v.id);
      return `
        <div class="vocab-card" data-vocab-id="${v.id}">
          <div class="vocab-head">
            <span class="vocab-term-kk">${v.kk}</span>
            <span class="vocab-pos">${v.pos}</span>
          </div>
          <div class="vocab-trans-ru">${v.ru}</div>
          <div class="vocab-example">
            <div class="vocab-example-kk">«${v.exampleKk}»</div>
            <div class="vocab-example-ru">${v.exampleRu}</div>
          </div>
          <button class="btn btn-secondary btn-toggle-mastered" data-vocab-id="${v.id}" style="margin-top: 0.5rem; font-size: 0.78rem;">
            ${isMastered ? '✓ В словаре' : '+ Запомнить'}
          </button>
        </div>
      `;
    }).join('');

    // Assemble the complete lesson page
    contentArea.innerHTML = `
      <div class="lesson-header-box">
        <span class="lesson-meta-tag">Урок ${lesson.number} • ${lesson.period}</span>
        <h2 class="lesson-title-main">${lesson.titleKk}</h2>
        <h3 class="lesson-title-sub">${lesson.titleRu}</h3>
        <div>
          <span class="source-badge">📖 Источник: ${lesson.sourceCitation}</span>
          <span class="review-flag-badge">🔍 ${lesson.verificationStatus}</span>
        </div>
        ${lesson.disputedNote ? `<p style="margin-top: 0.75rem; font-size: 0.85rem; color: #854d0e; background: #fefce8; padding: 0.5rem 0.75rem; border-radius: 4px;"><strong>Историческая заметка:</strong> ${lesson.disputedNote}</p>` : ''}
      </div>

      <!-- Key historical entities -->
      <div class="key-entities-bar">
        <div class="entity-pill-box">
          <div class="entity-pill-title">Ключевые даты:</div>
          <div class="tags-wrap">${lesson.keyFacts.dates.map(d => `<span class="tag-badge">${d}</span>`).join('')}</div>
        </div>
        <div class="entity-pill-box">
          <div class="entity-pill-title">Исторические личности:</div>
          <div class="tags-wrap">${lesson.keyFacts.people.map(p => `<span class="tag-badge">${p}</span>`).join('')}</div>
        </div>
        <div class="entity-pill-box">
          <div class="entity-pill-title">Термины урока:</div>
          <div class="tags-wrap">${lesson.keyFacts.terms.map(t => `<span class="tag-badge term-link">${t}</span>`).join('')}</div>
        </div>
      </div>

      <!-- Bilingual reading text -->
      <div class="reading-section">
        ${paragraphsHtml}
      </div>

      <!-- Vocabulary section -->
      <div class="lesson-vocab-section">
        <h3>📚 Новые слова и термины (${lessonVocab.length})</h3>
        <div class="vocab-grid">
          ${vocabCardsHtml}
        </div>
      </div>

      <!-- Quiz for this lesson -->
      <div class="quiz-box" id="lesson-quiz-widget">
        <!-- Rendered by renderQuiz() -->
      </div>
    `;

    // Render the interactive quiz widget
    renderQuizWidget(lesson.id, 'lesson-quiz-widget');

    // Attach vocabulary handlers
    contentArea.querySelectorAll('.term-interactive').forEach(el => {
      el.addEventListener('click', () => {
        const termId = el.getAttribute('data-term-id');
        openTermModal(termId);
      });
    });

    contentArea.querySelectorAll('.btn-toggle-mastered').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const vId = btn.getAttribute('data-vocab-id');
        toggleMasteredVocab(vId, btn);
      });
    });

    // Setup mode switcher listeners
    const switcherBtns = document.querySelectorAll('.switch-btn');
    switcherBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === appState.bilingualMode);
      btn.onclick = () => {
        switcherBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.bilingualMode = btn.getAttribute('data-mode');
        contentArea.className = `lesson-content-wrapper mode-${appState.bilingualMode}`;
        persistState();
      };
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- 5. QUIZ ENGINE (PER-LESSON & REVIEW) ---
  function renderQuizWidget(quizId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const questions = QUIZ_DATA[quizId];
    if (!questions || questions.length === 0) return;

    const savedResult = appState.quizResults[quizId];

    container.innerHTML = `
      <div class="quiz-header">
        <h3 class="quiz-title">📝 Проверочный тест по теме</h3>
        <p class="quiz-subtitle">Ответьте на вопросы, чтобы закрепить понимание исторического материала и терминологии.</p>
      </div>
      <form id="form-${quizId}">
        ${questions.map((q, qIndex) => `
          <div class="question-block" id="q-block-${q.id}">
            <div class="question-prompt">${qIndex + 1}. ${q.questionKk}</div>
            <div class="question-prompt-ru">${q.questionRu}</div>
            <div class="options-list">
              ${q.options.map(opt => `
                <button type="button" class="option-btn" data-qid="${q.id}" data-optid="${opt.id}">
                  <span><strong>${opt.id.toUpperCase()})</strong> ${opt.textKk} / ${opt.textRu}</span>
                </button>
              `).join('')}
            </div>
            <div class="feedback-box hidden" id="feedback-${q.id}"></div>
          </div>
        `).join('')}
      </form>
      <div id="quiz-summary-${quizId}">
        ${savedResult ? `
          <div class="quiz-score-summary">
            <div>Тест уже был пройден ранее с результатом:</div>
            <div class="quiz-score-num">${savedResult.score} из ${savedResult.total}</div>
            <button class="btn btn-secondary btn-retake-quiz" data-quizid="${quizId}" style="margin-top: 0.5rem;">Пройти заново ↻</button>
          </div>
        ` : ''}
      </div>
    `;

    // Track state of current attempt
    let answers = {};
    let isSubmitted = false;

    const optionButtons = container.querySelectorAll('.option-btn');
    optionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (isSubmitted) return;
        const qid = btn.getAttribute('data-qid');
        const optid = btn.getAttribute('data-optid');

        // Deselect others in same question
        container.querySelectorAll(`.option-btn[data-qid="${qid}"]`).forEach(b => {
          b.style.borderColor = '';
          b.style.background = '';
        });

        // Mark selection
        btn.style.borderColor = 'var(--primary-color)';
        btn.style.background = 'var(--primary-light)';
        answers[qid] = optid;

        // Auto-check if all questions answered
        if (Object.keys(answers).length === questions.length) {
          evaluateQuiz(quizId, container, answers, questions);
          isSubmitted = true;
        }
      });
    });

    const retakeBtn = container.querySelector('.btn-retake-quiz');
    if (retakeBtn) {
      retakeBtn.addEventListener('click', () => {
        renderQuizWidget(quizId, containerId);
      });
    }
  }

  function evaluateQuiz(quizId, container, answers, questions) {
    let score = 0;

    questions.forEach(q => {
      const selectedId = answers[q.id];
      const feedbackBox = container.querySelector(`#feedback-${q.id}`);
      const buttons = container.querySelectorAll(`.option-btn[data-qid="${q.id}"]`);

      buttons.forEach(btn => {
        btn.disabled = true;
        const optId = btn.getAttribute('data-optid');
        if (optId === q.correctId) {
          btn.classList.add('selected-correct');
        } else if (optId === selectedId) {
          btn.classList.add('selected-wrong');
        }
      });

      feedbackBox.classList.remove('hidden');
      if (selectedId === q.correctId) {
        score++;
        feedbackBox.className = 'feedback-box correct';
        feedbackBox.innerHTML = `✓ <strong>Дұрыс! / Правильно!</strong> ${q.explanationRu}`;
      } else {
        feedbackBox.className = 'feedback-box wrong';
        feedbackBox.innerHTML = `✕ <strong>Қате! / Ошибка!</strong> ${q.explanationRu}`;
      }
    });

    // Save progress
    appState.quizResults[quizId] = {
      score: score,
      total: questions.length,
      date: new Date().toLocaleDateString('ru-RU')
    };

    if (quizId !== 'review' && !appState.completedLessons.includes(quizId)) {
      appState.completedLessons.push(quizId);
    }
    persistState();

    // Show summary box
    const summaryBox = container.querySelector(`#quiz-summary-${quizId}`);
    if (summaryBox) {
      const pct = Math.round((score / questions.length) * 100);
      summaryBox.innerHTML = `
        <div class="quiz-score-summary">
          <div>Тест завершен! Результат:</div>
          <div class="quiz-score-num">${score} из ${questions.length} (${pct}%)</div>
          <p style="font-size: 0.9rem; margin-top: 0.4rem; color: var(--text-muted);">
            ${pct >= 70 ? '🎉 Отличный результат! Материал усвоен.' : '💡 Рекомендуем еще раз перечитать текст урока.'}
          </p>
          <button class="btn btn-secondary btn-retake-quiz" data-quizid="${quizId}" style="margin-top: 0.75rem;">Пройти заново ↻</button>
        </div>
      `;

      summaryBox.querySelector('.btn-retake-quiz').addEventListener('click', () => {
        renderQuizWidget(quizId, container.id);
      });
    }
  }

  function renderReviewQuiz() {
    renderQuizWidget('review', 'review-quiz-container');
  }

  // --- 6. TIMELINE RENDERING ---
  function renderTimeline(centuryFilter) {
    const container = document.getElementById('timeline-events-container');
    if (!container) return;

    let filtered = TIMELINE_DATA;
    if (centuryFilter !== 'all') {
      const c = parseInt(centuryFilter, 10);
      filtered = TIMELINE_DATA.filter(ev => ev.century === c);
    }

    container.innerHTML = filtered.map(ev => `
      <div class="timeline-event-card">
        <div class="timeline-node-dot" aria-hidden="true"></div>
        <span class="timeline-year-badge">${ev.yearDisplay} (${ev.century} ғ. / в.)</span>
        <h3 class="timeline-title-kk">${ev.titleKk}</h3>
        <h4 class="timeline-title-ru">${ev.titleRu}</h4>
        <p class="timeline-desc-kk">${ev.descKk}</p>
        <p class="timeline-desc-ru">${ev.descRu}</p>
        <button class="btn btn-secondary btn-timeline-goto" data-lesson-id="${ev.lessonId}" style="margin-top: 0.75rem; font-size: 0.82rem;">
          Перейти к теме урока →
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-timeline-goto').forEach(btn => {
      btn.addEventListener('click', () => {
        const lessonId = btn.getAttribute('data-lesson-id');
        switchTab('lessons');
        openLesson(lessonId);
      });
    });

    // Setup century filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === centuryFilter);
      btn.onclick = () => {
        renderTimeline(btn.getAttribute('data-filter'));
      };
    });
  }

  // --- 7. VOCABULARY VIEW ---
  function renderVocabularyList(searchQuery) {
    const container = document.getElementById('vocab-cards-grid');
    if (!container) return;

    const q = searchQuery.toLowerCase().trim();
    const filtered = VOCABULARY_DATA.filter(v => {
      if (!q) return true;
      return v.kk.toLowerCase().includes(q) || v.ru.toLowerCase().includes(q) || v.definitionRu.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: var(--text-muted);">Терминов по запросу «${searchQuery}» не найдено.</div>`;
      return;
    }

    container.innerHTML = filtered.map(v => {
      const isMastered = appState.masteredVocab.includes(v.id);
      return `
        <div class="vocab-card" data-vocab-id="${v.id}">
          <div class="vocab-head">
            <span class="vocab-term-kk">${v.kk}</span>
            <span class="vocab-pos">${v.pos}</span>
          </div>
          <div class="vocab-trans-ru">${v.ru}</div>
          <p style="font-size: 0.85rem; color: #475569; margin: 0.2rem 0;">${v.definitionRu}</p>
          <div class="vocab-example">
            <div class="vocab-example-kk">«${v.exampleKk}»</div>
            <div class="vocab-example-ru">${v.exampleRu}</div>
          </div>
          <button class="btn btn-secondary btn-vocab-master" data-vocab-id="${v.id}" style="margin-top: 0.5rem; font-size: 0.78rem;">
            ${isMastered ? '✓ Изучено' : '+ Отметить как изученное'}
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-vocab-master').forEach(btn => {
      btn.addEventListener('click', () => {
        const vId = btn.getAttribute('data-vocab-id');
        toggleMasteredVocab(vId, btn);
      });
    });

    const searchInput = document.getElementById('vocab-search-input');
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('input', (e) => {
        renderVocabularyList(e.target.value);
      });
    }
  }

  function toggleMasteredVocab(vocabId, buttonEl) {
    const idx = appState.masteredVocab.indexOf(vocabId);
    if (idx > -1) {
      appState.masteredVocab.splice(idx, 1);
      if (buttonEl) buttonEl.textContent = '+ Отметить как изученное';
    } else {
      appState.masteredVocab.push(vocabId);
      if (buttonEl) buttonEl.textContent = '✓ Изучено';
    }
    persistState();
  }

  // --- 8. PROGRESS DASHBOARD ---
  function renderProgressDashboard() {
    updateGlobalProgress();

    const list = document.getElementById('progress-lessons-list');
    if (!list) return;

    list.innerHTML = LESSONS_DATA.map(lesson => {
      const isCompleted = appState.completedLessons.includes(lesson.id);
      const res = appState.quizResults[lesson.id];
      return `
        <li class="progress-item">
          <div>
            <strong>Урок ${lesson.number}: ${lesson.titleRu}</strong>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${lesson.period}</div>
          </div>
          <div>
            ${res 
              ? `<span class="card-status completed">Тест: ${res.score}/${res.total}</span>` 
              : `<span class="card-status pending">Не завершен</span>`}
          </div>
        </li>
      `;
    }).join('');
  }

  // --- 9. TERMINOLOGY MODAL ---
  function openTermModal(termId) {
    const term = VOCABULARY_DATA.find(v => v.id === termId);
    if (!term) return;

    const modal = document.getElementById('term-modal');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    content.innerHTML = `
      <div style="margin-bottom: 0.5rem;">
        <span style="font-size: 0.8rem; color: var(--accent-gold); font-weight: 700; text-transform: uppercase;">Словарь терминов</span>
        <h3 style="font-size: 1.5rem; color: var(--primary-dark); margin: 0.2rem 0;">${term.kk}</h3>
        <p style="font-size: 1rem; color: #475569; font-weight: 600;">${term.ru}</p>
        <span style="display: inline-block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.8rem;">${term.pos}</span>
      </div>
      <div style="background: var(--bg-page); padding: 0.8rem; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-gold); margin-bottom: 1rem;">
        <p style="font-size: 0.95rem; line-height: 1.5;">${term.definitionRu}</p>
      </div>
      <div style="font-size: 0.9rem;">
        <strong>Мысал (Пример в контексте):</strong>
        <p style="color: var(--primary-dark); font-weight: 500; margin-top: 0.2rem;">«${term.exampleKk}»</p>
        <p style="color: var(--text-muted); font-size: 0.85rem;">${term.exampleRu}</p>
      </div>
    `;

    modal.classList.remove('hidden');

    const btnClose = document.getElementById('btn-modal-close');
    if (btnClose) {
      btnClose.onclick = () => modal.classList.add('hidden');
    }

    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    };
  }

  // --- 10. INITIALIZATION ---
  function init() {
    loadSavedState();
    initNavigation();
    renderLessonsList();
    updateGlobalProgress();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
