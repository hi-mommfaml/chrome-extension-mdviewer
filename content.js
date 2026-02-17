// MarkdownファイルをHTMLに変換して表示するスクリプト

// 現在のMarkdownテキストを保持（変更検知用）
let lastMarkdownText = '';

function convertMarkdown() {
  // Chromeがテキストファイルとして表示している場合、
  // 内容は通常 <pre> タグの中ラップされているか、あるいは body 直下にテキストとして存在します。
  const pre = document.querySelector('body > pre');
  let markdownText = '';

  if (pre) {
    markdownText = pre.innerText;
  } else {
    // preがない場合（念のため）、bodyのテキストを取得
    markdownText = document.body.innerText;
  }

  // 初期状態を保存
  lastMarkdownText = markdownText;

  // marked.js の存在確認
  if (typeof marked === 'undefined') {
    console.error('Error: marked object is not found. marked.js might have failed to load.');
    return;
  }

  // 初回レンダリング
  renderMarkdown(markdownText);

  // ローカルファイルの場合のみ自動更新を開始
  if (window.location.protocol === 'file:') {
    startAutoReload();
  }
}

/**
 * Markdownテキストを受け取ってHTMLに変換し、画面を更新する関数
 * 初回表示と自動更新の両方で使用する
 */
function renderMarkdown(text) {
  // Custom renderer to add file extensions to links
  const renderer = new marked.Renderer();
  const originalLink = renderer.link.bind(renderer);

  renderer.link = (href, title, text) => {
    try {
      // URLオブジェクトにしてパス部分のみを検証
      const url = new URL(href, 'http://dummy.com');
      const pathname = url.pathname;

      // 最後がスラッシュで終わる場合はディレクトリとみなしてスキップ
      if (!pathname.endsWith('/')) {
        const parts = pathname.split('.');
        if (parts.length > 1) {
          const ext = parts.pop().toLowerCase();
          // 表示しない拡張子リスト
          const ignoreExts = ['html', 'htm', 'php', 'jsp', 'asp', 'aspx'];

          if (!ignoreExts.includes(ext)) {
            const extLabel = `[${ext}]`;
            if (!text.includes(extLabel)) {
              return `<a href="${href}" title="${title || ''}">${text} <span class="file-ext">${extLabel}</span></a>`;
            }
          }
        }
      }
    } catch (e) {
      // URL解析エラー等は無視
    }
    return originalLink(href, title, text);
  };

  marked.use({ renderer });

  // [Pre-process]
  // 画像ファイル名にスペースが含まれているときの対応
  let preProcessedText = text.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    if (src.includes(' ')) {
      const encodedSrc = src.trim().split(' ').join('%20');
      return `![${alt}](${encodedSrc})`;
    }
    return match;
  });

  // 数式をプレースホルダーに置き換え
  const mathExpressions = [];

  // ブロック数式 $$...$$ を処理 (改行を含む)
  preProcessedText = preProcessedText.replace(/\$\$((?:.|\n)+?)\$\$/g, (match, math) => {
    const index = mathExpressions.length;
    mathExpressions.push({ type: 'block', math: math.trim() });
    return `<span class="math-placeholder" data-math-index="${index}"></span>`;
  });

  // インライン数式 $...$ を処理 (改行を含まない)
  preProcessedText = preProcessedText.replace(/\$([^$\n]+?)\$/g, (match, math) => {
    const index = mathExpressions.length;
    mathExpressions.push({ type: 'inline', math: math });
    return `<span class="math-placeholder" data-math-index="${index}"></span>`;
  });

  // HTMLに変換
  const currentUrl = window.location.href;
  const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
  const htmlContent = marked.parse(preProcessedText, { baseUrl: baseUrl });

  // DOM書き換え
  document.body.innerHTML = `
    <div class="main-container">
      <div class="markdown-body">
        ${htmlContent}
      </div>
    </div>
  `;

  document.title = 'Markdown Viewer';

  // 各機能の適用
  addCopyButtons();
  generateTOC();
  initTheme();
  renderMathAndDiagrams(mathExpressions);
}

function startAutoReload() {
  // console.log('Auto-reload started'); // Debug log removed
  setInterval(() => {
    chrome.runtime.sendMessage({ action: 'FETCH_FILE', url: window.location.href }, (response) => {
      if (chrome.runtime.lastError) {
        // 拡張機能が無効化された場合などにエラーが出るが、静かに終了する
        return;
      }

      if (response && response.success) {
        const text = response.data;
        if (text && text !== lastMarkdownText) {
          // 変更検知
          lastMarkdownText = text;

          // スクロール位置保存
          const scrollTop = window.scrollY;
          const sidebar = document.querySelector('.toc-sidebar');
          const sidebarScrollTop = sidebar ? sidebar.scrollTop : 0;

          // 再レンダリング
          renderMarkdown(text);

          // スクロール位置復元
          window.scrollTo(0, scrollTop);
          const newSidebar = document.querySelector('.toc-sidebar');
          if (newSidebar) {
            newSidebar.scrollTop = sidebarScrollTop;
          }
        }
      }
    });
  }, 1000); // 1秒ごとにチェック
}

function initTheme() {
  const savedTheme = localStorage.getItem('mdviewer-theme') || 'light';
  applyTheme(savedTheme);

  const btn = document.createElement('div');
  btn.className = 'theme-toggle-btn';
  updateThemeIcon(btn, savedTheme);

  btn.addEventListener('click', () => {
    const currentTheme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    updateThemeIcon(btn, newTheme);
    localStorage.setItem('mdviewer-theme', newTheme);
  });

  document.body.appendChild(btn);
}

function applyTheme(theme) {
  const lightId = 'theme-css-light';
  const darkId = 'theme-css-dark';

  let lightLink = document.getElementById(lightId);
  let darkLink = document.getElementById(darkId);

  const lightUrl = chrome.runtime.getURL('github-markdown-light.css');
  const darkUrl = chrome.runtime.getURL('github-markdown-dark.css');

  if (theme === 'dark') {
    document.body.classList.add('theme-dark');
    document.body.classList.remove('theme-light');

    if (!darkLink) {
      darkLink = document.createElement('link');
      darkLink.id = darkId;
      darkLink.rel = 'stylesheet';
      darkLink.href = darkUrl;
      document.head.appendChild(darkLink);
    }
    if (lightLink) lightLink.remove();

  } else {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');

    if (!lightLink) {
      lightLink = document.createElement('link');
      lightLink.id = lightId;
      lightLink.rel = 'stylesheet';
      lightLink.href = lightUrl;
      document.head.appendChild(lightLink);
    }
    if (darkLink) darkLink.remove();
  }

  // Mermaid図をテーマに合わせて再レンダリング
  reRenderMermaid();
}

function updateThemeIcon(btn, theme) {
  if (theme === 'dark') {
    btn.innerHTML = '&#x1F319;'; // Moon
  } else {
    btn.innerHTML = '&#x2600;&#xFE0F;'; // Sun
  }
}

function generateTOC() {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headings.length === 0) return;

  const sidebar = document.createElement('div');
  sidebar.className = 'toc-sidebar';

  const title = document.createElement('h2');
  title.innerText = 'Table of Contents';
  sidebar.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'toc-list';

  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = `heading-${index}`;
    }

    const li = document.createElement('li');
    li.className = `toc-item toc-level-${heading.tagName[1]}`;

    const a = document.createElement('a');
    a.href = `#${heading.id}`;
    a.innerText = heading.innerText;

    li.appendChild(a);
    list.appendChild(li);
  });

  sidebar.appendChild(list);
  document.body.appendChild(sidebar);
}

function addCopyButtons() {
  const blocks = document.querySelectorAll('pre');
  blocks.forEach(block => {
    if (block.querySelector('.copy-button')) return;

    const button = document.createElement('button');
    button.className = 'copy-button';
    button.textContent = 'Copy';
    button.type = 'button';
    button.addEventListener('click', () => {
      const code = block.querySelector('code');
      const text = code ? code.innerText : block.innerText;

      navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('success');
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('success');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
        button.textContent = 'Error';
      });
    });

    block.appendChild(button);
  });
}

function renderMathAndDiagrams(mathExpressions = []) {
  // Mermaid: ```mermaid ... ``` をレンダリング
  if (typeof mermaid !== 'undefined') {
    const theme = document.body.classList.contains('theme-dark') ? 'dark' : 'default';
    mermaid.initialize({
      startOnLoad: false,
      theme: theme,
      securityLevel: 'strict'
    });

    const mermaidBlocks = document.querySelectorAll('pre code.language-mermaid');
    mermaidBlocks.forEach((code) => {
      const mermaidCode = code.textContent;
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = mermaidCode;
      div.setAttribute('data-mermaid-code', mermaidCode); // コードを保存
      code.parentElement.replaceWith(div);
    });

    mermaid.run().catch(e => console.error('Mermaid error:', e));
  }

  // KaTeX: プレースホルダーを数式に置き換え
  if (typeof katex !== 'undefined' && mathExpressions.length > 0) {
    const placeholders = document.querySelectorAll('.math-placeholder');
    placeholders.forEach(placeholder => {
      const index = parseInt(placeholder.getAttribute('data-math-index'));
      const mathData = mathExpressions[index];

      if (mathData) {
        try {
          const rendered = katex.renderToString(mathData.math, {
            displayMode: mathData.type === 'block',
            throwOnError: false,
            trust: false
          });

          if (mathData.type === 'block') {
            const div = document.createElement('div');
            div.innerHTML = rendered;
            div.className = 'katex-block';
            placeholder.replaceWith(div);
          } else {
            const span = document.createElement('span');
            span.innerHTML = rendered;
            placeholder.replaceWith(span);
          }
        } catch (e) {
          console.error('KaTeX rendering error:', e);
          placeholder.textContent = mathData.type === 'block'
            ? `$$${mathData.math}$$`
            : `$${mathData.math}$`;
        }
      }
    });
  }
}

function reRenderMermaid() {
  if (typeof mermaid === 'undefined') return;

  // 現在のテーマを取得
  const theme = document.body.classList.contains('theme-dark') ? 'dark' : 'default';

  // 既存のMermaid div要素を取得
  const mermaidDivs = document.querySelectorAll('div.mermaid');

  if (mermaidDivs.length === 0) return;

  // 各Mermaid図のコードを保存
  const mermaidCodes = Array.from(mermaidDivs).map(div => {
    // data-processed属性がある場合、元のコードを取得する必要がある
    // Mermaidはレンダリング後にSVGに置き換えるため、元のテキストを保持
    return {
      element: div,
      code: div.getAttribute('data-mermaid-code') || div.textContent
    };
  });

  // Mermaidを新しいテーマで初期化
  mermaid.initialize({
    startOnLoad: false,
    theme: theme,
    securityLevel: 'strict'
  });

  // 既存のMermaid要素をクリア
  mermaidDivs.forEach(div => {
    const code = div.getAttribute('data-mermaid-code') || div.textContent;
    // 新しいdiv要素を作成
    const newDiv = document.createElement('div');
    newDiv.className = 'mermaid';
    newDiv.textContent = code;
    newDiv.setAttribute('data-mermaid-code', code);
    div.replaceWith(newDiv);
  });

  // 再レンダリング
  mermaid.run().catch(e => console.error('Mermaid re-render error:', e));
}

// 実行開始
convertMarkdown();
