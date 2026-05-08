<script lang="ts">
type Props = {
  html?: string;
  loading?: boolean;
  error?: string;
  warnings?: readonly string[];
  elapsedMs?: number | null;
  codeHighlight?: string;
};

let {
  html = '',
  loading = false,
  error = '',
  warnings = [],
  elapsedMs = null,
  codeHighlight = ''
}: Props = $props();
</script>

<section class="admin-editor-preview" aria-label="Markdown preview">
  <div class="admin-editor-pane__head">
    <div>
      <p class="admin-content-kicker">Preview</p>
      <h3 class="admin-content-section-title">服务端预览</h3>
    </div>
    {#if loading && html}
      <span class="admin-badge">更新中</span>
    {:else if elapsedMs !== null || codeHighlight}
      <span class="admin-badge">
        {elapsedMs !== null ? `${elapsedMs}ms` : codeHighlight}
      </span>
    {/if}
  </div>

  {#if html}
    <article class="admin-editor-preview__article prose" data-refreshing={loading ? 'true' : undefined}>
      {@html html}
    </article>
  {:else if loading}
    <div class="admin-editor-preview__empty">正在生成预览…</div>
  {:else if error}
    <div class="admin-editor-preview__error">{error}</div>
  {:else}
    <div class="admin-editor-preview__empty">预览将在正文载入后自动生成。</div>
  {/if}

  {#if error && html}
    <div class="admin-editor-preview__error admin-editor-preview__error--inline">{error}</div>
  {/if}

  {#if warnings.length > 0}
    <ul class="admin-editor-preview__warnings">
      {#each warnings as warning}
        <li>{warning}</li>
      {/each}
    </ul>
  {/if}
</section>
