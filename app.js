(() => {
  'use strict';

  const papers = Array.isArray(window.PAPERS) ? window.PAPERS : [];
  const datasets = Array.isArray(window.DATASETS) ? window.DATASETS : [];
  const PAGE_SIZE = 24;

  const state = {
    datasetCategory: 'all',
    paperCategory: 'all',
    datasetVisible: PAGE_SIZE,
    paperVisible: PAGE_SIZE
  };

  const byId = (id) => document.getElementById(id);
  const elements = {
    paperStat: byId('paper-stat'),
    datasetStat: byId('dataset-stat'),
    codeStat: byId('code-stat'),
    venueStat: byId('venue-stat'),
    datasetTabs: byId('dataset-category-tabs'),
    datasetSearch: byId('dataset-search'),
    datasetModality: byId('dataset-modality'),
    datasetAnatomy: byId('dataset-anatomy'),
    datasetAccess: byId('dataset-access'),
    datasetSort: byId('dataset-sort'),
    datasetSummary: byId('dataset-summary'),
    datasetGrid: byId('dataset-grid'),
    datasetMore: byId('dataset-more'),
    datasetClear: byId('dataset-clear'),
    paperTabs: byId('paper-category-tabs'),
    paperSearch: byId('paper-search'),
    paperYear: byId('paper-year'),
    paperCode: byId('paper-code'),
    paperSort: byId('paper-sort'),
    paperSummary: byId('paper-summary'),
    paperGrid: byId('paper-grid'),
    paperMore: byId('paper-more'),
    paperClear: byId('paper-clear'),
    backToTop: byId('back-to-top')
  };

  const categoryNames = {
    '2D': '2D',
    '3D': '3D',
    'Video / sequences': 'Video',
    'Pathology / microscopy': 'Pathology'
  };

  const nonVenueLabels = new Set([
    'IEEE publication (exact venue not independently verified)',
    'OpenReview paper (venue status not independently verified)',
    'KAUST institutional repository / manuscript'
  ]);

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value));
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch {
      return '#';
    }
  }

  function sourceLabel(value) {
    try {
      const host = new URL(value).hostname.replace(/^www\./, '');
      if (host === 'github.com') return 'GitHub';
      if (host.includes('grand-challenge.org')) return 'Grand Challenge';
      if (host.includes('kaggle.com')) return 'Kaggle';
      if (host.includes('huggingface.co')) return 'Hugging Face';
      if (host.includes('zenodo.org')) return 'Zenodo';
      if (host.includes('figshare.com')) return 'Figshare';
      if (host.includes('synapse.org')) return 'Synapse';
      if (host.includes('physionet.org')) return 'PhysioNet';
      return 'Dataset source';
    } catch {
      return 'Dataset source';
    }
  }

  function categoryChips(categories) {
    return (categories || []).map((category) => (
      `<span class="category-chip category-${escapeHtml(category.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${escapeHtml(categoryNames[category] || category)}</span>`
    )).join('');
  }

  function optionMarkup(values, label) {
    return `<option value="all">${escapeHtml(label)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
  }

  function canonicalVenueName(venue) {
    const normalized = String(venue || '')
      .replace(/\b(?:19|20)\d{2}\b/g, '')
      .replace(/\(\s*(?:published\s*)?\)/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([),;:])/g, '$1')
      .replace(/\(\s+/g, '(')
      .replace(/[\s,;:/\-–—]+$/g, '')
      .trim();
    return nonVenueLabels.has(normalized) ? '' : normalized;
  }

  function setupSummary() {
    const codeCount = papers.filter((paper) => Array.isArray(paper.codeUrls) && paper.codeUrls.length).length;
    const venues = new Set(papers.map((paper) => canonicalVenueName(paper.venue)).filter(Boolean));
    elements.paperStat.textContent = papers.length.toLocaleString();
    elements.datasetStat.textContent = datasets.length.toLocaleString();
    elements.codeStat.textContent = codeCount.toLocaleString();
    elements.venueStat.textContent = venues.size.toLocaleString();

    const modalities = [...new Set(datasets.flatMap((dataset) => dataset.modalities || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const anatomicalOrigins = [...new Set(datasets.flatMap((dataset) => dataset.anatomicalOrigins || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const accessRoutes = [...new Set(datasets.map((dataset) => dataset.access).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const years = [...new Set(papers.map((paper) => Number(paper.year)).filter(Boolean))].sort((a, b) => b - a);

    elements.datasetModality.innerHTML = optionMarkup(modalities, 'All modalities');
    elements.datasetAnatomy.innerHTML = optionMarkup(anatomicalOrigins, 'All anatomical origins');
    elements.datasetAccess.innerHTML = optionMarkup(accessRoutes, 'All access routes');
    elements.paperYear.innerHTML = `<option value="all">All years</option>${years.map((year) => `<option value="${year}">${year}</option>`).join('')}`;
  }

  function datasetMatches(dataset) {
    const query = elements.datasetSearch.value.trim().toLowerCase();
    const haystack = [
      dataset.name,
      dataset.version,
      dataset.content,
      dataset.origin,
      dataset.annotation,
      dataset.access,
      ...(dataset.modalities || []),
      ...(dataset.formatTypes || []),
      ...(dataset.anatomicalOrigins || []),
      ...(dataset.subjectTypes || []),
      ...(dataset.aliases || []),
      ...(dataset.categories || [])
    ].join(' ').toLowerCase();
    return (state.datasetCategory === 'all' || (dataset.categories || []).includes(state.datasetCategory))
      && (elements.datasetModality.value === 'all' || (dataset.modalities || []).includes(elements.datasetModality.value))
      && (elements.datasetAnatomy.value === 'all' || (dataset.anatomicalOrigins || []).includes(elements.datasetAnatomy.value))
      && (elements.datasetAccess.value === 'all' || dataset.access === elements.datasetAccess.value)
      && (!query || haystack.includes(query));
  }

  function filteredDatasets() {
    const result = datasets.filter(datasetMatches);
    const sort = elements.datasetSort.value;
    result.sort((a, b) => {
      if (sort === 'modality-asc') return String((a.modalities || []).join('; ')).localeCompare(String((b.modalities || []).join('; '))) || String(a.name).localeCompare(String(b.name));
      if (sort === 'access-asc') return String(a.access).localeCompare(String(b.access)) || String(a.name).localeCompare(String(b.name));
      return String(a.name).localeCompare(String(b.name));
    });
    return result;
  }

  function datasetCard(dataset) {
    const url = safeUrl(dataset.url);
    const accessSlug = String(dataset.access || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const modalities = (dataset.modalities || []).join(' / ') || 'Modality not specified';
    const detailRows = [
      ['Format', (dataset.formatTypes || []).join('; ')],
      ['Anatomy', (dataset.anatomicalOrigins || []).join('; ')],
      ['Source type', (dataset.subjectTypes || []).join('; ')],
      ['Version', dataset.version],
      ['Contents', dataset.content],
      ['Origin', dataset.origin],
      ['Known aliases', (dataset.aliases || []).join('; ')]
    ].filter(([, value]) => value).map(([label, value]) => (
      `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    )).join('');
    return `<article class="dataset-card" data-dataset-name="${escapeHtml(dataset.name)}">
      <div class="card-topline">
        <span class="modality-label">${escapeHtml(modalities)}</span>
        <span class="access-badge access-${escapeHtml(accessSlug)}">${escapeHtml(dataset.access || 'Access not specified')}</span>
      </div>
      <h3>${escapeHtml(dataset.name)}</h3>
      <p class="dataset-annotation"><strong>Annotations</strong>${escapeHtml(dataset.annotation || 'Segmentation annotations not specified.')}</p>
      <details class="record-details"><summary>Dataset details</summary><dl>${detailRows}</dl></details>
      <div class="card-footer">
        <div class="chip-row">${categoryChips(dataset.categories)}</div>
        ${url === '#' ? '' : `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(sourceLabel(url))} <span aria-hidden="true">&#8599;</span></a>`}
      </div>
    </article>`;
  }

  function renderDatasets() {
    const result = filteredDatasets();
    const visible = result.slice(0, state.datasetVisible);
    elements.datasetSummary.textContent = `Showing ${visible.length.toLocaleString()} of ${result.length.toLocaleString()} matching datasets`;
    elements.datasetGrid.innerHTML = visible.length
      ? visible.map(datasetCard).join('')
      : '<div class="empty-state"><h3>No datasets match these filters.</h3><p>Try a broader search or clear the active filters.</p></div>';
    elements.datasetMore.hidden = visible.length >= result.length;
  }

  function paperMatches(paper) {
    const query = elements.paperSearch.value.trim().toLowerCase();
    const haystack = [paper.title, paper.venue, paper.year, paper.identifier, ...(paper.authors || []), ...(paper.categories || [])].join(' ').toLowerCase();
    const hasCode = Array.isArray(paper.codeUrls) && paper.codeUrls.length > 0;
    const codeMatch = elements.paperCode.value === 'all'
      || (elements.paperCode.value === 'with-code' && hasCode)
      || (elements.paperCode.value === 'without-code' && !hasCode);
    return (state.paperCategory === 'all' || (paper.categories || []).includes(state.paperCategory))
      && (elements.paperYear.value === 'all' || Number(paper.year) === Number(elements.paperYear.value))
      && codeMatch
      && (!query || haystack.includes(query));
  }

  function filteredPapers() {
    const result = papers.filter(paperMatches);
    const sort = elements.paperSort.value;
    result.sort((a, b) => {
      if (sort === 'year-asc') return Number(a.year) - Number(b.year) || String(a.title).localeCompare(String(b.title));
      if (sort === 'title-asc') return String(a.title).localeCompare(String(b.title));
      return Number(b.year) - Number(a.year) || String(a.title).localeCompare(String(b.title));
    });
    return result;
  }

  function paperCard(paper) {
    const paperUrl = safeUrl(paper.paperUrl);
    const codeUrls = Array.isArray(paper.codeUrls) ? paper.codeUrls.map(safeUrl).filter((url) => url !== '#') : [];
    const codeLinks = codeUrls.map((url, index) => `<a class="card-link code-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${codeUrls.length > 1 ? `GitHub ${index + 1}` : 'GitHub'} <span aria-hidden="true">&#8599;</span></a>`).join('');
    const authors = Array.isArray(paper.authors) ? paper.authors : [];
    const authorSummary = authors.length > 4 ? `${authors.slice(0, 4).join('; ')}; et al.` : authors.join('; ');
    const fullAuthors = authors.join('; ');
    return `<article class="paper-card" data-paper-id="${escapeHtml(paper.id)}" data-debug-key="paper-${escapeHtml(paper.id)}">
      <div class="chip-row">${categoryChips(paper.categories)}</div>
      <h3>${escapeHtml(paper.title)}</h3>
      <p class="paper-authors" title="${escapeHtml(fullAuthors)}">${escapeHtml(authorSummary || 'Authors not listed')}</p>
      <p class="paper-meta"><span>${escapeHtml(paper.venue || 'Venue not listed')}</span><span>${escapeHtml(paper.year || 'Year not listed')}</span></p>
      ${paper.identifier ? `<p class="paper-identifier">${escapeHtml(paper.identifier)}</p>` : ''}
      <div class="paper-links">
        ${paperUrl === '#' ? '' : `<a class="card-link" href="${escapeHtml(paperUrl)}" target="_blank" rel="noreferrer">Paper <span aria-hidden="true">&#8599;</span></a>`}
        ${codeLinks || '<span class="no-code">No GitHub repository listed</span>'}
      </div>
    </article>`;
  }

  function renderPapers() {
    const result = filteredPapers();
    const visible = result.slice(0, state.paperVisible);
    elements.paperSummary.textContent = `Showing ${visible.length.toLocaleString()} of ${result.length.toLocaleString()} matching papers`;
    elements.paperGrid.innerHTML = visible.length
      ? visible.map(paperCard).join('')
      : '<div class="empty-state"><h3>No papers match these filters.</h3><p>Try a broader search or clear the active filters.</p></div>';
    elements.paperMore.hidden = visible.length >= result.length;
  }

  function setActiveTab(container, value) {
    container.querySelectorAll('button').forEach((button) => {
      const active = button.dataset.value === value;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function bindTabs(container, type) {
    container.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-value]');
      if (!button) return;
      const value = button.dataset.value;
      if (type === 'dataset') {
        state.datasetCategory = value;
        state.datasetVisible = PAGE_SIZE;
        renderDatasets();
      } else {
        state.paperCategory = value;
        state.paperVisible = PAGE_SIZE;
        renderPapers();
      }
      setActiveTab(container, value);
    });
  }

  function bindFilter(element, type) {
    const eventName = element.tagName === 'INPUT' ? 'input' : 'change';
    element.addEventListener(eventName, () => {
      if (type === 'dataset') {
        state.datasetVisible = PAGE_SIZE;
        renderDatasets();
      } else {
        state.paperVisible = PAGE_SIZE;
        renderPapers();
      }
    });
  }

  function clearDatasetFilters() {
    state.datasetCategory = 'all';
    state.datasetVisible = PAGE_SIZE;
    elements.datasetSearch.value = '';
    elements.datasetModality.value = 'all';
    elements.datasetAnatomy.value = 'all';
    elements.datasetAccess.value = 'all';
    elements.datasetSort.value = 'name-asc';
    setActiveTab(elements.datasetTabs, 'all');
    renderDatasets();
  }

  function clearPaperFilters() {
    state.paperCategory = 'all';
    state.paperVisible = PAGE_SIZE;
    elements.paperSearch.value = '';
    elements.paperYear.value = 'all';
    elements.paperCode.value = 'all';
    elements.paperSort.value = 'year-desc';
    setActiveTab(elements.paperTabs, 'all');
    renderPapers();
  }

  function bindTaxonomyJumps() {
    document.querySelectorAll('[data-jump-section][data-category]').forEach((button) => {
      button.addEventListener('click', () => {
        const section = button.dataset.jumpSection;
        const category = button.dataset.category;
        if (section === 'datasets') {
          state.datasetCategory = category;
          state.datasetVisible = PAGE_SIZE;
          setActiveTab(elements.datasetTabs, category);
          renderDatasets();
        } else {
          state.paperCategory = category;
          state.paperVisible = PAGE_SIZE;
          setActiveTab(elements.paperTabs, category);
          renderPapers();
        }
        byId(section).scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function bindNavigationObserver() {
    if (!('IntersectionObserver' in window)) return;
    const links = [...document.querySelectorAll('.site-nav a')];
    const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.toggleAttribute('aria-current', link.getAttribute('href') === `#${visible.target.id}`));
    }, { rootMargin: '-25% 0px -65% 0px', threshold: [0, 0.1, 0.4] });
    sections.forEach((section) => observer.observe(section));
  }

  setupSummary();
  bindTabs(elements.datasetTabs, 'dataset');
  bindTabs(elements.paperTabs, 'paper');
  [elements.datasetSearch, elements.datasetModality, elements.datasetAnatomy, elements.datasetAccess, elements.datasetSort].forEach((element) => bindFilter(element, 'dataset'));
  [elements.paperSearch, elements.paperYear, elements.paperCode, elements.paperSort].forEach((element) => bindFilter(element, 'paper'));
  elements.datasetMore.addEventListener('click', () => { state.datasetVisible += PAGE_SIZE; renderDatasets(); });
  elements.paperMore.addEventListener('click', () => { state.paperVisible += PAGE_SIZE; renderPapers(); });
  elements.datasetClear.addEventListener('click', clearDatasetFilters);
  elements.paperClear.addEventListener('click', clearPaperFilters);
  bindTaxonomyJumps();
  bindNavigationObserver();
  elements.backToTop.addEventListener('click', (event) => {
    event.preventDefault();
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    window.scrollTo({ top: 0, left: 0, behavior });
  });
  renderDatasets();
  renderPapers();

  window.MEDREFSEG_DEBUG = Object.freeze({
    paperCount: papers.length,
    datasetCount: datasets.length,
    getPaperById: (id) => papers.find((paper) => String(paper.id) === String(id)) || null,
    getDatasetByName: (name) => datasets.find((dataset) => dataset.name === name) || null,
    paperIdFromCard: (card) => card?.dataset?.paperId || null
  });
})();
