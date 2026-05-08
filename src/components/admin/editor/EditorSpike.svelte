<script lang="ts">
import { ADMIN_PREVIEW_API_PATH } from '../../../lib/admin-console/admin-api-paths';

type Props = {
  endpointLabel?: string;
  initialContent?: string;
};

let {
  endpointLabel = ADMIN_PREVIEW_API_PATH,
  initialContent = ''
}: Props = $props();

const baselineContent = initialContent;

let content = $state(initialContent);
let touched = $state(false);

const isDirty = $derived(content !== baselineContent);
const lineCount = $derived(content.length === 0 ? 1 : content.split(/\r\n|\r|\n/).length);
const charCount = $derived(content.length);
const trimmedCharCount = $derived(content.trim().length);

const markTouched = () => {
  touched = true;
};

const loadFixture = () => {
  content = [
    '# Svelte Island Spike',
    '',
    ':::note[状态]',
    'Svelte 5 runes 已接入 Astro island。',
    ':::',
    '',
    '```ts',
    'const isDirty = content !== baselineContent;',
    '```'
  ].join('\n');
  touched = true;
};

const resetContent = () => {
  content = baselineContent;
  touched = false;
};
</script>

<section class="admin-editor-spike" data-admin-svelte-spike="mounted">
  <div class="admin-editor-spike__head">
    <div class="admin-editor-spike__intro">
      <p class="admin-overview-card__eyebrow">Svelte Island</p>
      <h2 class="admin-overview-card__title">EditorSpike</h2>
    </div>
    <span class="admin-badge" data-tone={isDirty ? 'warning' : 'success'}>
      {isDirty ? 'dirty' : 'clean'}
    </span>
  </div>

  <label class="admin-field">
    <span class="admin-field__label">Markdown body</span>
    <textarea
      class="admin-field__control admin-editor-spike__textarea"
      bind:value={content}
      oninput={markTouched}
      rows="10"
      spellcheck="false"
    ></textarea>
  </label>

  <div class="admin-editor-spike__actions">
    <button class="admin-btn admin-btn--secondary" type="button" onclick={loadFixture}>
      载入示例
    </button>
    <button class="admin-btn admin-btn--ghost" type="button" onclick={resetContent} disabled={!isDirty && !touched}>
      重置
    </button>
  </div>

  <dl class="admin-data-meta admin-editor-spike__meta">
    <dt class="admin-data-meta__label">lines</dt>
    <dd class="admin-data-meta__value">{lineCount}</dd>
    <dt class="admin-data-meta__label">chars</dt>
    <dd class="admin-data-meta__value">{charCount}</dd>
    <dt class="admin-data-meta__label">trimmed</dt>
    <dd class="admin-data-meta__value">{trimmedCharCount}</dd>
    <dt class="admin-data-meta__label">preview api</dt>
    <dd class="admin-data-meta__value"><code>{endpointLabel}</code></dd>
  </dl>
</section>
