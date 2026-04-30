/**
 * マージ元を読み取りのみで src/pages/merged/lpXXX/index.astro を生成する（同階に空の _style.css）。
 * Usage: node scripts/emit-merged-page.mjs <001|002|003|...>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function parsePageImports(pageAstroSrc) {
  /** lp00x から import しているコンポーネント名（順序維持・重複除去） */
  const names = [];
  const re = /import\s+\w+\s+from\s+['"]@\/components\/lp\d+\/(\w+)\.astro['"]/g;
  let m;
  while ((m = re.exec(pageAstroSrc))) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

function parseMultiStylePage(src) {
  if (!src.startsWith('---\n')) throw new Error('frontmatter required');
  const end = src.indexOf('\n---\n', 4);
  if (end === -1) throw new Error('close ---');
  const script = src.slice(4, end);
  const rest = src.slice(end + 5);
  const firstStyleIdx = rest.search(/<style\b/);
  const template = firstStyleIdx === -1 ? rest.trimEnd() : rest.slice(0, firstStyleIdx).trimEnd();
  const styles = [];
  const styleRe = /<style([^>]*)>([\s\S]*?)<\/style>/g;
  let sm;
  while ((sm = styleRe.exec(rest))) {
    styles.push({ attrs: sm[1].trim(), raw: sm[0], inner: sm[2] });
  }
  return { script, template, styles };
}

function extractImports(script) {
  const lines = script.split('\n');
  const out = [];
  let buf = null;
  for (const line of lines) {
    if (/^\s*import\s/.test(line) && buf === null) {
      buf = line;
      if (/from\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) {
        out.push(buf);
        buf = null;
      }
      continue;
    }
    if (buf !== null) {
      buf += '\n' + line;
      if (/from\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) {
        out.push(buf);
        buf = null;
      }
    }
  }
  if (buf) out.push(buf);
  return out;
}

function isNestedPageComponentImport(line, pageFolder) {
  const esc = pageFolder.replace(/\\/g, '/');
  return new RegExp(`from\\s+['"]@/components/${esc}/`).test(line);
}

function extractNonImports(script) {
  const lines = script.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*import\s/.test(line)) {
      let block = line;
      while (!/from\s+['"][^'"]+['"]\s*;?\s*$/.test(block.split('\n').pop() || '') && i + 1 < lines.length) {
        i++;
        block += '\n' + lines[i];
      }
      i++;
      continue;
    }
    /** `export interface Props { ... }` を丸ごと除外（1行だけ除外すると本体が残って構文エラーになる） */
    if (/^\s*(export\s+)?interface\s+\w+/.test(line)) {
      let depth = 0;
      for (const ch of line) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      i++;
      while (i < lines.length && depth > 0) {
        const L = lines[i];
        for (const ch of L) {
          if (ch === '{') depth++;
          if (ch === '}') depth--;
        }
        i++;
      }
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join('\n').trimEnd();
}

/** style タグ内本文から @layer lism-custom の本体を抜く（無ければ全文トリム） */
function extractLayerInner(inner) {
  const lm = inner.match(/@layer\s+lism-custom\s*\{([\s\S]*)\}\s*$/);
  if (lm) return lm[1].trim();
  const m2 = inner.match(/@layer\s+lism-custom\s*\{([\s\S]*)\}/);
  if (m2) return m2[1].trim();
  return inner.trim();
}

function mergeNamedSymbolImports(importLines, modulePath) {
  const esc = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = new Set();
  for (const imp of importLines) {
    const m = imp.match(new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${esc}['"]`, 's'));
    if (!m) continue;
    m[1].split(',').forEach((part) => {
      const n = part.trim();
      if (n) names.add(n);
    });
  }
  return [...names].sort();
}

/** lp001 用 HGroup（クラス接頭辞 z--lp001-hgroup） */
function inlineHGroup001(html) {
  let s = html.replace(
    /<HGroup\s+text=['"]([^'"]*)['"]\s+subText=['"]([^'"]*)['"](\s+variant=['"]light['"])?\s*\/>/g,
    (_, text, sub, variant) => {
      const light = variant ? ', "z--lp001-hgroup--light"' : '';
      return `<Stack class:list={['z--lp001-hgroup'${light}]} as='hgroup' ai='c' g='5'>
      <Heading level='2' class='z--lp001-hgroup_heading' fz='3xl' fw='400' lts='l' m='0'>${text}</Heading>
      <Heading level='3' class='z--lp001-hgroup_subHeading' d='inline-flex' ai='c' g='20' fz='s' fw='normal' lts='l' m='0'>
        ${sub}
      </Heading>
    </Stack>`;
    }
  );
  s = s.replace(
    /<HGroup\s+text="([^"]*)"\s+subText="([^"]*)"(\s+variant="light")?\s*\/>/g,
    (_, text, sub, variant) => {
      const light = variant ? ', "z--lp001-hgroup--light"' : '';
      return `<Stack class:list={["z--lp001-hgroup"${light}]} as="hgroup" ai="c" g="5">
      <Heading level="2" class="z--lp001-hgroup_heading" fz="3xl" fw="400" lts="l" m="0">${text}</Heading>
      <Heading level="3" class="z--lp001-hgroup_subHeading" d="inline-flex" ai="c" g="20" fz="s" fw="normal" lts="l" m="0">
        ${sub}
      </Heading>
    </Stack>`;
    }
  );
  return s;
}

/** lp003: Logo を Header/Footer へインライン（logoLabel はマージ先 frontmatter で定義） */
function inlineLogo003(html) {
  const headerLogo = `<Link
      class='z--lp003-header_logoLink'
      href='#'
      td='none'
      fw='normal'
      ff='accent'
      c='white'
      lts='l'
      fz={['2xl', null, '3xl']}
      lh='s'
      whs='nowrap'
    >
      {logoLabel}
    </Link>`;
  const footerLogo = `<Heading level='2' m='0' fz={['2xl', null, '3xl']} fw='normal' lts='l' lh='l' ff='accent'>
      {logoLabel}
    </Heading>`;
  let s = html.replace(/<Logo\s+variant=['"]header['"]\s+href=['"]#['"]\s*\/>/g, headerLogo);
  s = s.replace(/<Logo\s+variant=['"]footer['"]\s*\/>/g, footerLogo);
  return s;
}

const PAGE_CONFIG = {
  '001': {
    folder: 'lp001',
    pfx: 'p001',
    compOrder: [
      'Header',
      'MV',
      'About',
      'Feature',
      'Works',
      'News',
      'FAQ',
      'Testimonials',
      'Information',
      'Contact',
      'Footer',
    ],
    extraCompScripts: ['HGroup'],
    buildWrapper: () =>
      `<DemoLayout title={title}>\n  <Wrapper contentSize='full'>\n`,
    buildMainInner: (blocks) => `    <!-- Header -->
    ${blocks.Header}
    <!-- Main Content -->
    <Container as='main' class='z--lp001-main'>
      ${blocks.MV}
      ${blocks.About}
      ${blocks.Feature}
      ${blocks.Works}
      ${blocks.News}
      ${blocks.FAQ}
      ${blocks.Testimonials}
      ${blocks.Information}
      ${blocks.Contact}
    </Container>
    <!-- Footer -->
    ${blocks.Footer}`,
    buildClosing: () => `  </Wrapper>\n</DemoLayout>\n`,
    postProcessTemplate: (s) => inlineHGroup001(s),
    logoConst: null,
  },
  '002': {
    folder: 'lp002',
    pfx: 'p002',
    compOrder: ['Header', 'MV', 'Mission', 'Mission2', 'Footer', 'Feature', 'Service', 'Step', 'Voice', 'FAQ', 'Contact'],
    extraCompScripts: [],
    buildWrapper: () =>
      `<DemoLayout title={title}>\n  <link rel='preconnect' href='https://fonts.googleapis.com' slot='head' />\n  <link rel='preconnect' href='https://fonts.gstatic.com' crossorigin slot='head' />\n  <link\n    href='https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap'\n    rel='stylesheet'\n    slot='head'\n  />\n  <Wrapper class='z--lp002-root' contentSize='full'>\n`,
    buildMainInner: (blocks) => `    <!-- Header -->
    ${blocks.Header}
    <!-- Main Content -->
    <Container as='main' class='z--lp002-main' pos='relative' z='0'>
      ${blocks.MV}
      ${blocks.Mission}
      ${blocks.Mission2}
      ${blocks.Feature}
      ${blocks.Service}
      ${blocks.Step}
      ${blocks.Voice}
      ${blocks.FAQ}
      ${blocks.Contact}
    </Container>
    <!-- Footer -->
    ${blocks.Footer}`,
    buildClosing: () => `  </Wrapper>\n</DemoLayout>\n`,
    postProcessTemplate: (s) => s,
    logoConst: null,
  },
  '003': {
    folder: 'lp003',
    pfx: 'p003',
    compOrder: [
      'Header',
      'MV',
      'About',
      'Feature',
      'Feature2',
      'Plans',
      'Information',
      'FAQ',
      'Footer',
      'Reservation',
      'ReservationFab',
    ],
    extraCompScripts: [],
    buildWrapper: () =>
      `<DemoLayout title={title}>\n  <link rel='preconnect' href='https://fonts.googleapis.com' slot='head' />\n  <link rel='preconnect' href='https://fonts.gstatic.com' crossorigin slot='head' />\n  <link\n    href='https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@200..900&family=Yuji+Syuku&display=swap'\n    rel='stylesheet'\n    slot='head'\n  />\n  <Wrapper class='z--lp003-root' contentSize='full'>\n`,
    buildMainInner: (blocks) => `    <!-- Header -->
    ${blocks.Header}
    <!-- Main Content -->
    <Container as='main' class='z--lp003-main' pos='relative' z='0'>
      ${blocks.MV}
      <!-- MV の動的 @keyframes はマージで抽出されないため、元コンポーネントと同じ set:html を明示注入 -->
      <style set:html={mvLayeredKeyframesStyle} />
      ${blocks.About}
      ${blocks.Feature}
      ${blocks.Feature2}
      ${blocks.Plans}
      ${blocks.Information}
      ${blocks.FAQ}
      ${blocks.Reservation}
    </Container>
    <!-- Footer -->
    ${blocks.Footer}
    ${blocks.ReservationFab}`,
    buildClosing: () => `  </Wrapper>\n</DemoLayout>\n`,
    postProcessTemplate: (s) => inlineLogo003(s),
    logoConst: "const logoLabel = '静寂の隠れ宿';",
  },
};

function run(pageId) {
  const cfg = PAGE_CONFIG[pageId];
  if (!cfg) throw new Error(`Unknown page id: ${pageId}. Known: ${Object.keys(PAGE_CONFIG).join(', ')}`);

  const pageFolder = cfg.folder;
  const compDir = path.join(root, 'src/components', pageFolder);

  const pagePath = path.join(root, 'src/pages', `${pageFolder}.astro`);
  const pageSrc = fs.readFileSync(pagePath, 'utf8');
  const { script: pageScript, template: _ignoreTpl, styles: pageStyles } = parseMultiStylePage(pageSrc);

  const compOrderFromPage = parsePageImports(pageSrc);
  if (JSON.stringify(compOrderFromPage) !== JSON.stringify(cfg.compOrder)) {
    console.warn(
      `WARN [${pageId}]: PAGE_CONFIG.compOrder と page の import 順が異なります。\n  page:`,
      compOrderFromPage,
      '\n  cfg:',
      cfg.compOrder
    );
  }


  const allImports = [];
  const visitScripts = [...cfg.compOrder, ...cfg.extraCompScripts];
  for (const name of visitScripts) {
    const p = path.join(compDir, `${name}.astro`);
    if (!fs.existsSync(p)) continue;
    const { script } = parseMultiStylePage(fs.readFileSync(p, 'utf8'));
    for (const imp of extractImports(script)) {
      if (isNestedPageComponentImport(imp, pageFolder)) continue;
      allImports.push(imp.trim());
    }
  }
  for (const imp of extractImports(pageScript)) {
    if (isNestedPageComponentImport(imp, pageFolder)) continue;
    allImports.push(imp.trim());
  }

  const lismNames = mergeNamedSymbolImports(allImports, 'lism-css/astro');
  const uiNames = mergeNamedSymbolImports(allImports, '@lism-css/ui/astro');

  const importLines = [
    `import DemoLayout from '@/layouts/DemoLayout.astro';`,
    `import {\n  ${lismNames.join(',\n  ')}\n} from 'lism-css/astro';`,
    ...(uiNames.length ? [`import { ${uiNames.join(', ')} } from '@lism-css/ui/astro';`] : []),
  ];

  const constParts = [];
  if (cfg.logoConst) constParts.push(cfg.logoConst);

  for (const name of cfg.compOrder) {
    const p = path.join(compDir, `${name}.astro`);
    const { script } = parseMultiStylePage(fs.readFileSync(p, 'utf8'));
    const body = extractNonImports(script);
    if (body) constParts.push(body);
  }

  const titleLine = pageScript.match(/export const title[^\n]+/);
  const extraImports = cfg.extraFrontmatterImports ?? [];
  const mergedScript = `---
${importLines.join('\n')}
${extraImports.length ? `${extraImports.join('\n')}\n` : ''}
${titleLine ? titleLine[0] : ''}

${constParts.join('\n\n')}
---
`;

  const blocks = {};
  for (const name of cfg.compOrder) {
    const p = path.join(compDir, `${name}.astro`);
    const { template } = parseMultiStylePage(fs.readFileSync(p, 'utf8'));
    blocks[name] = cfg.postProcessTemplate(template);
  }

  const mainInner = cfg.buildMainInner(blocks);
  const outTemplate = `${cfg.buildWrapper()}${mainInner}
${cfg.buildClosing()}`;

  const layerInners = [];
  for (const st of pageStyles) {
    layerInners.push(extractLayerInner(st.inner));
  }
  for (const name of cfg.compOrder) {
    const p = path.join(compDir, `${name}.astro`);
    const { styles } = parseMultiStylePage(fs.readFileSync(p, 'utf8'));
    for (const st of styles) {
      layerInners.push(extractLayerInner(st.inner));
    }
  }
  for (const name of cfg.extraCompScripts) {
    const p = path.join(compDir, `${name}.astro`);
    if (!fs.existsSync(p)) continue;
    const { styles } = parseMultiStylePage(fs.readFileSync(p, 'utf8'));
    for (const st of styles) {
      layerInners.push(extractLayerInner(st.inner));
    }
  }

  const mergedStyle = `<style>
  @layer lism-custom {

${layerInners.filter(Boolean).join('\n\n')}

  }
</style>
`;

  const out = `${mergedScript.trimEnd()}\n\n${outTemplate}\n${mergedStyle}`;
  /** マージ元フォルダ名（lp001）と同一のパスに出力する */
  const outDir = path.join(root, 'src/pages/merged', pageFolder);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'index.astro');
  fs.writeFileSync(outPath, out, 'utf8');
  const stylePath = path.join(outDir, '_style.css');
  fs.writeFileSync(stylePath, '', 'utf8');
  console.log('Wrote', outPath, `(${(out.length / 1024).toFixed(1)} KB)`);
  console.log('Wrote', stylePath, '(empty)');
}

const id = process.argv[2];
if (!id || !PAGE_CONFIG[id]) {
  console.error('Usage: node scripts/emit-merged-page.mjs <001|002|003>');
  process.exit(1);
}
run(id);
