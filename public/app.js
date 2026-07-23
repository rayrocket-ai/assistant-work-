/* Interactive bilingual lead form. Renders dynamically from /api/config. */
(function () {
  'use strict';

  var lang = localStorage.getItem('lead_lang') || 'en';
  var cfg = null;

  // state.screen: 'intent' | 'contact' | 'qualify' | 'success'
  var state = { screen: 'intent', intent: null, answers: {} };

  var appEl = document.getElementById('app');
  var brandEl = document.getElementById('brand');
  var footerEl = document.getElementById('footer');
  var btnEn = document.getElementById('lang-en');
  var btnFa = document.getElementById('lang-fa');

  function T(obj) { return obj ? (obj[lang] || obj.en || '') : ''; }
  function U(key) { return T(cfg.ui[key]); }

  function applyLangChrome() {
    document.documentElement.lang = lang === 'fa' ? 'fa' : 'en';
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    btnEn.classList.toggle('active', lang === 'en');
    btnFa.classList.toggle('active', lang === 'fa');
    if (cfg) {
      brandEl.textContent = T(cfg.brand.name);
      footerEl.textContent = T(cfg.brand.name);
    }
  }

  function setLang(next) {
    lang = next;
    localStorage.setItem('lead_lang', lang);
    applyLangChrome();
    render();
  }

  btnEn.addEventListener('click', function () { setLang('en'); });
  btnFa.addEventListener('click', function () { setLang('fa'); });

  // ---- element helpers ------------------------------------------------------

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'html') e.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') {
          e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function clear() { appEl.innerHTML = ''; }

  function progressBar(pct) {
    return el('div', { class: 'progress' }, [el('span', { style: 'width:' + pct + '%' })]);
  }

  // ---- screens --------------------------------------------------------------

  function renderIntent() {
    clear();
    appEl.appendChild(el('p', { class: 'tagline' }, [T(cfg.brand.tagline)]));
    appEl.appendChild(el('h1', { class: 'step-title' }, [U('intro')]));
    var tiles = el('div', { class: 'tiles' });
    cfg.intents.forEach(function (intent) {
      tiles.appendChild(el('button', {
        class: 'tile', type: 'button',
        onClick: function () { chooseIntent(intent.id); },
      }, [
        el('span', { class: 'emoji' }, [intent.emoji]),
        el('span', { class: 't-body' }, [
          el('span', { class: 't-label', style: 'display:block' }, [T(intent.label)]),
          el('span', { class: 't-sub' }, [T(intent.sub)]),
        ]),
        el('span', { class: 'chev' }, [lang === 'fa' ? '‹' : '›']),
      ]));
    });
    appEl.appendChild(tiles);
  }

  function chooseIntent(id) {
    state.intent = id;
    state.screen = 'contact';
    render();
  }

  function currentIntent() {
    return cfg.intents.find(function (i) { return i.id === state.intent; });
  }

  // Build a field DOM node for a question definition.
  function fieldNode(q) {
    var wrap = el('div', { class: 'field', 'data-qid': q.id });
    var labelRow = el('label', { for: 'f_' + q.id }, [
      T(q.label),
      q.required ? el('span', { class: 'req' }, [' *']) : el('span', { class: 'opt' }, [' (' + (lang === 'fa' ? 'اختیاری' : 'optional') + ')']),
    ]);
    wrap.appendChild(labelRow);

    var val = state.answers[q.id];

    if (q.type === 'buttons') {
      var choices = el('div', { class: 'choices' });
      q.options.forEach(function (opt) {
        var b = el('button', {
          class: 'choice' + (val === opt.value ? ' selected' : ''),
          type: 'button',
          onClick: function () {
            state.answers[q.id] = opt.value;
            Array.prototype.forEach.call(choices.children, function (c) { c.classList.remove('selected'); });
            b.classList.add('selected');
            wrap.classList.remove('invalid');
          },
        }, [T(opt.label)]);
        choices.appendChild(b);
      });
      wrap.appendChild(choices);
    } else if (q.type === 'select') {
      var sel = el('select', {
        id: 'f_' + q.id,
        onChange: function (e) { state.answers[q.id] = e.target.value; wrap.classList.remove('invalid'); },
      });
      sel.appendChild(el('option', { value: '' }, ['—']));
      q.options.forEach(function (opt) {
        var o = el('option', { value: opt.value }, [T(opt.label)]);
        if (val === opt.value) o.selected = true;
        sel.appendChild(o);
      });
      wrap.appendChild(sel);
    } else if (q.type === 'textarea') {
      wrap.appendChild(el('textarea', {
        id: 'f_' + q.id,
        placeholder: q.placeholder ? T(q.placeholder) : '',
        oninput: function (e) { state.answers[q.id] = e.target.value; wrap.classList.remove('invalid'); },
      }, [val || '']));
    } else {
      var input = el('input', {
        id: 'f_' + q.id,
        type: q.type === 'tel' ? 'tel' : 'text',
        placeholder: q.placeholder ? T(q.placeholder) : '',
        value: val || '',
        oninput: function (e) { state.answers[q.id] = e.target.value; wrap.classList.remove('invalid'); },
      });
      wrap.appendChild(input);
    }

    wrap.appendChild(el('div', { class: 'field-error' }, [U('required')]));
    return wrap;
  }

  function validateQuestions(questions) {
    var firstBad = null;
    questions.forEach(function (q) {
      if (!q.required) return;
      var v = state.answers[q.id];
      var empty = v === undefined || v === null || String(v).trim() === '';
      var node = appEl.querySelector('[data-qid="' + q.id + '"]');
      if (empty) {
        if (node) node.classList.add('invalid');
        if (!firstBad) firstBad = node;
      } else if (node) {
        node.classList.remove('invalid');
      }
    });
    if (firstBad) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return !firstBad;
  }

  function renderStep(screen) {
    clear();
    var isContact = screen === 'contact';
    var questions = isContact ? cfg.contactQuestions : currentIntent().questions;

    appEl.appendChild(progressBar(isContact ? 50 : 85));
    appEl.appendChild(el('h1', { class: 'step-title' }, [
      isContact ? U('contactHeading') : T(currentIntent().label),
    ]));
    appEl.appendChild(el('p', { class: 'step-hint' }, [
      U('step') + ' ' + (isContact ? '1' : '2') + ' ' + U('of') + ' 2',
    ]));

    var form = el('div');
    questions.forEach(function (q) { form.appendChild(fieldNode(q)); });
    appEl.appendChild(form);

    var nav = el('div', { class: 'nav' });
    nav.appendChild(el('button', {
      class: 'btn btn-ghost', type: 'button',
      onClick: function () {
        if (isContact) { state.screen = 'intent'; render(); }
        else { state.screen = 'contact'; render(); }
      },
    }, [U('back')]));

    if (isContact) {
      nav.appendChild(el('button', {
        class: 'btn btn-primary', type: 'button',
        onClick: function () {
          if (validateQuestions(cfg.contactQuestions)) { state.screen = 'qualify'; render(); }
        },
      }, [U('next')]));
    } else {
      var submitBtn = el('button', { class: 'btn btn-primary', type: 'button' }, [U('submit')]);
      submitBtn.addEventListener('click', function () {
        if (!validateQuestions(currentIntent().questions)) return;
        submit(submitBtn);
      });
      nav.appendChild(submitBtn);
    }
    appEl.appendChild(nav);
  }

  function renderSuccess() {
    clear();
    var s = el('div', { class: 'success' }, [
      el('div', { class: 'check' }, ['✓']),
      el('h2', {}, [U('thanksHeading')]),
      el('p', {}, [U('thanksBody')]),
      el('button', {
        class: 'btn btn-primary', type: 'button', style: 'width:100%',
        onClick: function () {
          state = { screen: 'intent', intent: null, answers: {} };
          render();
        },
      }, [U('another')]),
    ]);
    appEl.appendChild(s);
  }

  function submit(btn) {
    btn.disabled = true;
    btn.textContent = U('submitting');
    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: state.intent, language: lang, answers: state.answers }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('bad status');
        return r.json();
      })
      .then(function () { state.screen = 'success'; render(); })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = U('submit');
        alert(U('errorGeneric'));
      });
  }

  function render() {
    if (state.screen === 'intent') renderIntent();
    else if (state.screen === 'contact' || state.screen === 'qualify') {
      renderStep(state.screen === 'contact' ? 'contact' : 'qualify');
    } else if (state.screen === 'success') renderSuccess();
    window.scrollTo(0, 0);
  }

  // ---- boot -----------------------------------------------------------------

  fetch('/api/config')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      cfg = data;
      applyLangChrome();
      render();
    })
    .catch(function () {
      appEl.textContent = 'Failed to load. Please refresh.';
    });
})();
