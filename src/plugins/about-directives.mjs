import { visit } from 'unist-util-visit';

const ABOUT_DIRECTIVE_ATTR = 'data-about-directive';
const FRIEND_MARKER = '__aboutFriendCard';
const FAQ_MARKER = '__aboutFaqItem';
const LOCAL_IMAGE_EXT_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const DATA_URL_RE = /^data:/i;
const ABOUT_SOURCE_PATH_RE = /(?:^|\/)src\/content\/about\/index\.md(?:$|[?#])/i;

const toOptionalString = (value) =>
  typeof value === 'string' ? value.trim() : '';

const hasInvalidLocalImagePathSegment = (value) =>
  /(^|\/)\.\.(?:\/|$)/.test(value) || value.includes('?') || value.includes('#');

const getVFilePath = (file) =>
  String(file?.path ?? file?.history?.[0] ?? '').replace(/\\/g, '/');

const shouldTransformAboutDirectives = (file, options = {}) => {
  if (options.enabled === true) return true;
  if (typeof options.enabled === 'function') return options.enabled(file);
  return ABOUT_SOURCE_PATH_RE.test(getVFilePath(file));
};

export const normalizeAboutDirectiveFriendUrl = (value) => {
  const trimmed = toOptionalString(value);
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

export const normalizeAboutDirectiveAvatarSource = (value, base = '/') => {
  const trimmed = toOptionalString(value);
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    // Fall through to local path normalization.
  }

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.startsWith('//')
    || normalized.startsWith('public/')
    || /^[A-Za-z]+:\/\//.test(normalized)
    || DATA_URL_RE.test(normalized)
    || normalized.includes(':')
    || hasInvalidLocalImagePathSegment(normalized)
    || !LOCAL_IMAGE_EXT_RE.test(normalized)
  ) {
    return '';
  }

  const baseNormalized = base.endsWith('/') ? base : `${base}/`;
  return `${baseNormalized}${normalized}`.replace(/\/{2,}/g, '/');
};

const getAvatarLetter = (name) => Array.from(name.trim())[0] ?? '友';

const getText = (node) => {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) return node.children.map(getText).join('');
  return '';
};

const createText = (value) => ({ type: 'text', value });

const createElement = (tagName, properties = {}, children = []) => ({
  type: 'element',
  tagName,
  properties,
  children
});

export function remarkAboutDirectives(options = {}) {
  return (tree, file) => {
    if (!shouldTransformAboutDirectives(file, options)) return;

    visit(tree, 'containerDirective', (node) => {
      if (node.name !== 'friend' && node.name !== 'faq') return;

      const attributes = node.attributes || {};
      if (!node.data) node.data = {};
      node.data.hName = 'div';
      node.data.hProperties = {
        [ABOUT_DIRECTIVE_ATTR]: node.name,
        ...(node.name === 'friend'
          ? {
              'data-about-name': toOptionalString(attributes.name),
              'data-about-url': toOptionalString(attributes.url),
              'data-about-avatar': toOptionalString(attributes.avatar)
            }
          : {
              'data-about-question': toOptionalString(attributes.question)
            })
      };
    });
  };
}

const toCamelCasePropertyName = (key) =>
  key.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());

const toPropertyString = (properties, key) => {
  const value = properties?.[key] ?? properties?.[toCamelCasePropertyName(key)];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const createFriendNode = (node, base) => {
  const properties = node.properties || {};
  const name = toPropertyString(properties, 'data-about-name').trim();
  const url = normalizeAboutDirectiveFriendUrl(toPropertyString(properties, 'data-about-url'));
  if (!name || !url) return null;

  const avatarSrc = normalizeAboutDirectiveAvatarSource(toPropertyString(properties, 'data-about-avatar'), base);
  const description = getText(node).replace(/\s+/g, ' ').trim();
  const avatarClassName = ['friend-card__avatar'];
  if (avatarSrc) avatarClassName.push('friend-card__avatar--image');

  const avatarChildren = [];
  if (avatarSrc) {
    avatarChildren.push(createElement('img', {
      src: avatarSrc,
      alt: '',
      loading: 'lazy',
      decoding: 'async'
    }));
  }
  avatarChildren.push(createElement('span', { className: ['friend-card__avatar-text'] }, [
    createText(getAvatarLetter(name))
  ]));

  const bodyChildren = [
    createElement('span', { className: ['friend-card__name'] }, [createText(name)])
  ];
  if (description) {
    bodyChildren.push(
      createElement('span', { className: ['friend-card__description'] }, [createText(description)])
    );
  }

  return createElement('li', { [FRIEND_MARKER]: true }, [
    createElement('a', { className: ['friend-card'], href: url }, [
      createElement('span', {
        className: avatarClassName,
        'aria-hidden': 'true'
      }, avatarChildren),
      createElement('span', { className: ['friend-card__body'] }, bodyChildren)
    ])
  ]);
};

const createFaqNode = (node) => {
  const question = toPropertyString(node.properties || {}, 'data-about-question').trim();
  if (!question) return null;

  return createElement('details', { className: ['qa-item'], [FAQ_MARKER]: true }, [
    createElement('summary', { className: ['qa-question'] }, [
      createElement('span', { className: ['qa-icon'], 'aria-hidden': 'true' }, [createText('Q')]),
      createText(question)
    ]),
    createElement('div', { className: ['qa-answer'] }, node.children || [])
  ]);
};

const transformDirectiveNode = (node, base) => {
  if (node.type !== 'element') return node;
  const directive = toPropertyString(node.properties || {}, ABOUT_DIRECTIVE_ATTR);
  if (directive === 'friend') return createFriendNode(node, base);
  if (directive === 'faq') return createFaqNode(node);
  return node;
};

const isWhitespaceTextNode = (node) => node?.type === 'text' && !node.value.trim();

const isMarkedDirectiveNode = (node, marker) =>
  node?.type === 'element' && node.properties?.[marker];

const collectDirectiveRun = (children, startIndex, marker) => {
  const items = [];
  let index = startIndex;

  while (index < children.length) {
    const child = children[index];
    if (isMarkedDirectiveNode(child, marker)) {
      delete child.properties[marker];
      items.push(child);
      index += 1;
      continue;
    }

    if (isWhitespaceTextNode(child)) {
      let lookahead = index + 1;
      while (isWhitespaceTextNode(children[lookahead])) {
        lookahead += 1;
      }
      if (isMarkedDirectiveNode(children[lookahead], marker)) {
        index = lookahead;
        continue;
      }
    }

    break;
  }

  return { items, nextIndex: index };
};

const groupDirectiveRuns = (parent) => {
  if (!Array.isArray(parent.children)) return;

  const nextChildren = [];
  for (let index = 0; index < parent.children.length;) {
    const child = parent.children[index];

    if (isMarkedDirectiveNode(child, FRIEND_MARKER)) {
      const { items: friends, nextIndex } = collectDirectiveRun(parent.children, index, FRIEND_MARKER);
      index = nextIndex;
      nextChildren.push(createElement('ul', { className: ['friend-list'] }, friends));
      continue;
    }

    if (isMarkedDirectiveNode(child, FAQ_MARKER)) {
      const { items: faqItems, nextIndex } = collectDirectiveRun(parent.children, index, FAQ_MARKER);
      index = nextIndex;
      nextChildren.push(createElement('div', {
        className: ['qa-list'],
        'aria-label': '常见问题'
      }, faqItems));
      continue;
    }

    nextChildren.push(child);
    index += 1;
  }

  parent.children = nextChildren;
};

export function rehypeAboutDirectives(options = {}) {
  const base = typeof options.base === 'string' && options.base.trim()
    ? options.base.trim()
    : '/';

  return (tree, file) => {
    if (!shouldTransformAboutDirectives(file, options)) return;

    visit(tree, 'element', (node, index, parent) => {
      const transformed = transformDirectiveNode(node, base);
      if (transformed && transformed !== node && parent && typeof index === 'number') {
        parent.children[index] = transformed;
      }
    });

    visit(tree, (node) => {
      groupDirectiveRuns(node);
    });
  };
}
