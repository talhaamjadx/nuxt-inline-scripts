import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { hash } from 'ohash';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import { join, dirname } from 'pathe';
import {
  INLINE_SCRIPTS_DEFAULT_OPTIONS,
  INTERNAL_PREFIX,
} from '../constant.js';

// generate a short hash by content
export function generateHash(content: string) {
  return hash({ value: content });
}

export function extractInlineScript(html: string, options: { output: string }) {
  // @ts-ignore
  if (process?.dev || process?.env?.NODE_ENV === 'development') {
    // dev mode skip
    return html;
  }

  const inlineScript = html.matchAll(/<script( [^>]*)?>([\s\S]*?)<\/script>/g);
  const { output } = options;
  const scripts = Array.from(inlineScript);

  for (const [script, attributes, scriptContent] of scripts) {
    // Skip empty scripts
    if (!scriptContent || !scriptContent.trim()) {
      continue;
    }

    // Skip scripts that already have a src attribute
    if (attributes && attributes.includes('src=')) {
      continue;
    }

    // Skip JSON-LD and other data scripts (type="application/ld+json", type="application/json", etc.)
    if (
      attributes &&
      /type\s*=\s*["']application\/(ld\+)?json["']/i.test(attributes)
    ) {
      continue;
    }

    const hash = generateHash(scriptContent);
    const filename = `${hash}.js`;
    let filePath = join(output, filename);
    const path = `${INTERNAL_PREFIX}/${filename}`;

    if (!existsSync(filePath)) {
      // if no directory, create it
      if (!existsSync(dirname(filePath))) {
        mkdirSync(dirname(filePath), { recursive: true });
      }
      writeFileSync(filePath, scriptContent);
    }

    // Preserve script attributes if they exist
    const newScript = attributes
      ? `<script${attributes} src="${path}"></script>`
      : `<script src="${path}"></script>`;

    // Replace this specific script tag (escape special regex characters)
    const escapedScript = script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(escapedScript), newScript);
  }
  return html;
}

export default defineNitroPlugin(async nitroApp => {
  nitroApp.hooks.hook(
    // @ts-ignore
    'render:html',
    (
      html: {
        head: string[];
        body: string[];
        bodyPrepend: string[];
        bodyAppend: string[];
      },
      { event }: { event: any }
    ) => {
      // @ts-ignore
      const options = INLINE_SCRIPTS_DEFAULT_OPTIONS;
      // const options = useRuntimeConfig()?.inlineScripts || process.env?.RUNTIME_CONFIG?.inlineScripts || INLINE_SCRIPTS_DEFAULT_OPTIONS;
      if (Array.isArray(html.head) && html.head.length > 0) {
        html.head = html.head.map(item => extractInlineScript(item, options));
      }
      if (Array.isArray(html.body) && html.body.length > 0) {
        html.body = html.body.map(item => extractInlineScript(item, options));
      }
      if (Array.isArray(html.bodyPrepend) && html.bodyPrepend.length > 0) {
        html.bodyPrepend = html.bodyPrepend.map(item =>
          extractInlineScript(item, options)
        );
      }
      if (Array.isArray(html.bodyAppend) && html.bodyAppend.length > 0) {
        html.bodyAppend = html.bodyAppend.map(item =>
          extractInlineScript(item, options)
        );
      }
    }
  );
});
//
