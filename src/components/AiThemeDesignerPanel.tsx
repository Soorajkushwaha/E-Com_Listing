import React, { useState } from 'react';
import {
  CheckCircle2,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { AIProvider, CatalogTheme, Product } from '../types/catalog';
import { formatINR, validateThemeSchema } from '../utils/catalogLogic';
import { ProductVisual } from './ProductVisual';

interface AiThemeDesignerPanelProps {
  themes: CatalogTheme[];
  activeTheme: CatalogTheme;
  previousThemeId: string;
  sampleProduct: Product;
  onSaveAndActivateTheme: (theme: Partial<CatalogTheme>, activate: boolean) => Promise<void>;
  onActivateExistingTheme: (themeId: string) => Promise<void>;
}

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  gemini: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'],
  openai: ['gpt-4o-mini', 'gpt-4o'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  grok: ['grok-2-latest', 'grok-beta'],
  local: ['deterministic-preset-engine'],
};

const EXAMPLE_PROMPTS = [
  'Create a premium Diwali catalog with a dark background, gold accents, elegant typography, festive lighting, rounded product cards, and prominent bulk order buttons.',
  'Create a royal Indian wedding trousseau catalog with deep crimson surfaces, warm ivory text, and editorial serif headings.',
  'Design an executive B2B corporate gifting catalog with a crisp slate background, high-trust cobalt accents, and modern geometric sans typography.',
  'Create a minimalist monochrome luxury atelier catalog with obsidian black surfaces and subtle champagne gold borders.',
];

export const AiThemeDesignerPanel: React.FC<AiThemeDesignerPanelProps> = ({
  themes,
  activeTheme,
  previousThemeId,
  sampleProduct,
  onSaveAndActivateTheme,
  onActivateExistingTheme,
}) => {
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [model, setModel] = useState<string>('gemini-3.8-flash');
  const [prompt, setPrompt] = useState<string>(EXAMPLE_PROMPTS[0]);
  const [draftTheme, setDraftTheme] = useState<Omit<CatalogTheme, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>({
    name: activeTheme.name,
    primaryColor: activeTheme.primaryColor,
    secondaryColor: activeTheme.secondaryColor,
    backgroundColor: activeTheme.backgroundColor,
    surfaceColor: activeTheme.surfaceColor,
    textColor: activeTheme.textColor,
    accentColor: activeTheme.accentColor,
    headingFont: activeTheme.headingFont,
    bodyFont: activeTheme.bodyFont,
    cardLayout: activeTheme.cardLayout,
    borderRadius: activeTheme.borderRadius,
    buttonStyle: activeTheme.buttonStyle,
    isPublic: true,
  });

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const schemaCheck = validateThemeSchema(draftTheme);

  const handleProviderChange = (next: AIProvider) => {
    setProvider(next);
    setModel(PROVIDER_MODELS[next][0]);
  };

  const handleGenerateWithAi = async () => {
    setGenerating(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const resp = await fetch('/api/ai/generate-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider, model }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Theme generation failed.');
      }
      const check = validateThemeSchema(data.theme);
      if (!check.valid || !check.theme) {
        throw new Error(`Generated theme failed schema validation: ${check.errors.join(' ')}`);
      }
      setDraftTheme(check.theme);
      setStatusMessage(
        data.notice ||
          `Generated and schema-validated "${check.theme.name}" via ${data.providerUsed} (${data.modelUsed}). Inspect the live preview below before applying.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to generate theme.');
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyTheme = async (saveAsNew: boolean) => {
    if (!schemaCheck.valid || !schemaCheck.theme) {
      setErrorMessage(schemaCheck.errors.join(' '));
      return;
    }
    setSaving(true);
    setErrorMessage('');
    try {
      await onSaveAndActivateTheme(
        {
          ...schemaCheck.theme,
          name: saveAsNew ? draftTheme.name : draftTheme.name,
        },
        true
      );
      setStatusMessage(
        `Applied theme "${draftTheme.name}" across Catalog Builder and Shop without modifying any product or order records.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save theme.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestorePreviousTheme = async () => {
    if (!previousThemeId) return;
    await onActivateExistingTheme(previousThemeId);
    const prev = themes.find((t) => t.id === previousThemeId);
    if (prev) {
      setDraftTheme({
        name: prev.name,
        primaryColor: prev.primaryColor,
        secondaryColor: prev.secondaryColor,
        backgroundColor: prev.backgroundColor,
        surfaceColor: prev.surfaceColor,
        textColor: prev.textColor,
        accentColor: prev.accentColor,
        headingFont: prev.headingFont,
        bodyFont: prev.bodyFont,
        cardLayout: prev.cardLayout,
        borderRadius: prev.borderRadius,
        buttonStyle: prev.buttonStyle,
        isPublic: true,
      });
      setStatusMessage(`Restored previous theme "${prev.name}".`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-stone-900">
            AI Theme Designer &amp; Brand Style Studio
          </h2>
          <p className="text-xs text-stone-500 max-w-2xl">
            Describe your seasonal occasion or brand aesthetic in plain English. All AI requests are proxied server-side
            and validated against a strict JSON schema—never executing arbitrary CSS or JS.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRestorePreviousTheme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore Previous Theme
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
        >
          {errorMessage}
        </div>
      )}

      {/* Ready-Made Presets Bar */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            Saved &amp; Ready-Made Theme Presets ({themes.length})
          </h3>
          <span className="text-xs text-stone-500">
            Currently Active: <strong className="text-stone-900">{activeTheme.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {themes.map((preset) => {
            const isSelected = preset.id === activeTheme.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setDraftTheme({
                    name: preset.name,
                    primaryColor: preset.primaryColor,
                    secondaryColor: preset.secondaryColor,
                    backgroundColor: preset.backgroundColor,
                    surfaceColor: preset.surfaceColor,
                    textColor: preset.textColor,
                    accentColor: preset.accentColor,
                    headingFont: preset.headingFont,
                    bodyFont: preset.bodyFont,
                    cardLayout: preset.cardLayout,
                    borderRadius: preset.borderRadius,
                    buttonStyle: preset.buttonStyle,
                    isPublic: true,
                  });
                  onActivateExistingTheme(preset.id);
                }}
                className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-amber-600 ring-2 ring-amber-500/20 bg-amber-50/30'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span
                    className="h-4 w-4 rounded-full border border-stone-300"
                    style={{ backgroundColor: preset.backgroundColor }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-stone-300"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-stone-300"
                    style={{ backgroundColor: preset.accentColor }}
                  />
                </div>
                <div className="text-xs font-bold text-stone-900 truncate">{preset.name}</div>
                <div className="text-[11px] text-stone-500 truncate">{preset.headingFont}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: Left AI Generator & Token Editor + Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left AI Controls & Fine-Tuning (6 cols) */}
        <div className="lg:col-span-6 rounded-xl border border-stone-200 bg-white p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ai-provider" className="block text-xs font-semibold text-stone-700 mb-1">
                AI Provider
              </label>
              <select
                id="ai-provider"
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900"
              >
                <option value="gemini">Google Gemini (Server-Side SDK)</option>
                <option value="openai">OpenAI (Server-Side Proxy)</option>
                <option value="deepseek">DeepSeek (Server-Side Proxy)</option>
                <option value="grok">Grok / xAI (Server-Side Proxy)</option>
                <option value="local">None / Local Theme Synthesizer</option>
              </select>
            </div>

            <div>
              <label htmlFor="ai-model" className="block text-xs font-semibold text-stone-700 mb-1">
                Model Selection
              </label>
              <select
                id="ai-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900"
              >
                {PROVIDER_MODELS[provider].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>
              Server-side API credentials are managed via encrypted environment secrets (<code>/api/ai/generate-theme</code>
              ) and never exposed in browser storage.
            </span>
          </div>

          <div>
            <label htmlFor="ai-prompt" className="block text-xs font-semibold text-stone-700 mb-1">
              Natural-Language Theme Prompt
            </label>
            <textarea
              id="ai-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe colors, mood, occasion, typography, and card style..."
              className="w-full rounded-lg border border-stone-300 p-3 text-xs text-stone-900 focus:border-amber-600 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-100"
                >
                  Example #{i + 1}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={generating}
            onClick={handleGenerateWithAi}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            <Wand2 className="h-4 w-4" />
            {generating ? 'Generating Structured Theme...' : 'Generate Theme with AI'}
          </button>

          {/* Fine-Tune Generated Tokens */}
          <div className="space-y-4 border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Fine-Tune Theme Tokens
              </span>
              <span
                className={`text-xs font-semibold ${
                  schemaCheck.valid ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {schemaCheck.valid ? 'Schema Validated' : 'Invalid Token'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="theme-name-input" className="block text-xs font-medium text-stone-700 mb-1">
                  Theme Name
                </label>
                <input
                  id="theme-name-input"
                  type="text"
                  value={draftTheme.name}
                  onChange={(e) => setDraftTheme((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900"
                />
              </div>

              <div>
                <label htmlFor="theme-heading-font" className="block text-xs font-medium text-stone-700 mb-1">
                  Heading Font Family
                </label>
                <select
                  id="theme-heading-font"
                  value={draftTheme.headingFont}
                  onChange={(e) => setDraftTheme((p) => ({ ...p, headingFont: e.target.value }))}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                >
                  <option value="Cormorant Garamond">Cormorant Garamond (Luxury Serif)</option>
                  <option value="Outfit">Outfit (Modern Architectural Sans)</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Clean Geometric)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(
                [
                  ['backgroundColor', 'Canvas Background'],
                  ['surfaceColor', 'Card Surface'],
                  ['primaryColor', 'Primary Heading'],
                  ['accentColor', 'CTA & Accent'],
                  ['textColor', 'Body Text'],
                  ['secondaryColor', 'Secondary Tone'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">{label}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={draftTheme[key]}
                      onChange={(e) => setDraftTheme((p) => ({ ...p, [key]: e.target.value }))}
                      className="h-7 w-8 cursor-pointer rounded border border-stone-300"
                    />
                    <input
                      type="text"
                      value={draftTheme[key]}
                      onChange={(e) => setDraftTheme((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs font-mono text-stone-900"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">Card Layout</label>
                <select
                  value={draftTheme.cardLayout}
                  onChange={(e) => setDraftTheme((p) => ({ ...p, cardLayout: e.target.value as any }))}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                >
                  <option value="editorial">Editorial</option>
                  <option value="bordered">Bordered</option>
                  <option value="elevated">Elevated</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">Border Radius</label>
                <select
                  value={draftTheme.borderRadius}
                  onChange={(e) => setDraftTheme((p) => ({ ...p, borderRadius: e.target.value as any }))}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                >
                  <option value="none">Sharp (0px)</option>
                  <option value="sm">Small (6px)</option>
                  <option value="md">Medium (12px)</option>
                  <option value="lg">Large (16px)</option>
                  <option value="xl">Extra Rounded</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">Button Style</label>
                <select
                  value={draftTheme.buttonStyle}
                  onChange={(e) => setDraftTheme((p) => ({ ...p, buttonStyle: e.target.value as any }))}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                >
                  <option value="solid">Solid Fill</option>
                  <option value="outline">Outline</option>
                  <option value="soft">Soft Tint</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() =>
                  setDraftTheme({
                    name: activeTheme.name,
                    primaryColor: activeTheme.primaryColor,
                    secondaryColor: activeTheme.secondaryColor,
                    backgroundColor: activeTheme.backgroundColor,
                    surfaceColor: activeTheme.surfaceColor,
                    textColor: activeTheme.textColor,
                    accentColor: activeTheme.accentColor,
                    headingFont: activeTheme.headingFont,
                    bodyFont: activeTheme.bodyFont,
                    cardLayout: activeTheme.cardLayout,
                    borderRadius: activeTheme.borderRadius,
                    buttonStyle: activeTheme.buttonStyle,
                    isPublic: true,
                  })
                }
                className="rounded-lg border border-stone-300 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Reset to Active
              </button>

              <button
                type="button"
                disabled={saving || !schemaCheck.valid}
                onClick={() => handleApplyTheme(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-stone-800 disabled:opacity-40 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Save &amp; Apply Theme to Catalog
              </button>
            </div>
          </div>
        </div>

        {/* Right Live Interactive Preview (6 cols) */}
        <div
          className="lg:col-span-6 rounded-2xl border border-stone-300 p-6 sm:p-8 space-y-6 transition-colors"
          style={{
            backgroundColor: draftTheme.backgroundColor,
            color: draftTheme.textColor,
            fontFamily: `'${draftTheme.bodyFont}', sans-serif`,
          }}
        >
          <div className="flex items-center justify-between text-xs opacity-75">
            <span>LIVE THEME PREVIEW: {draftTheme.name.toUpperCase()}</span>
            <span>
              {draftTheme.headingFont} + {draftTheme.bodyFont}
            </span>
          </div>

          <div
            className="p-6 border space-y-2"
            style={{
              backgroundColor: draftTheme.surfaceColor,
              borderColor: 'rgba(128,128,128,0.22)',
              borderRadius:
                draftTheme.borderRadius === 'none'
                  ? '0px'
                  : draftTheme.borderRadius === 'sm'
                  ? '6px'
                  : draftTheme.borderRadius === 'md'
                  ? '12px'
                  : '18px',
            }}
          >
            <div
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: draftTheme.accentColor }}
            >
              Seasonal Showcase Banner
            </div>
            <h3
              className="text-2xl font-bold"
              style={{
                fontFamily: `'${draftTheme.headingFont}', serif`,
                color: draftTheme.primaryColor,
              }}
            >
              Sovereign Festive &amp; Corporate Collection
            </h3>
            <p className="text-xs opacity-85">
              Previewing live typography, surface contrast, and bulk order CTA button styling before applying.
            </p>
          </div>

          {/* Sample Product Card inside Preview */}
          <div
            className="max-w-sm mx-auto overflow-hidden border"
            style={{
              backgroundColor: draftTheme.surfaceColor,
              borderColor: 'rgba(128,128,128,0.25)',
              borderRadius:
                draftTheme.borderRadius === 'none'
                  ? '0px'
                  : draftTheme.borderRadius === 'sm'
                  ? '6px'
                  : draftTheme.borderRadius === 'md'
                  ? '12px'
                  : '18px',
            }}
          >
            <ProductVisual product={sampleProduct} className="aspect-4/3 w-full" />
            <div className="p-5 space-y-3">
              <div className="text-xs opacity-75">
                {sampleProduct.brand} · {sampleProduct.category} · {sampleProduct.sku}
              </div>
              <h4
                className="text-lg font-bold"
                style={{ fontFamily: `'${draftTheme.headingFont}', serif` }}
              >
                {sampleProduct.heading || sampleProduct.name}
              </h4>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-lg font-bold" style={{ color: draftTheme.primaryColor }}>
                  {formatINR(sampleProduct.sellingPrice)}
                </span>
                <span className="text-xs line-through opacity-60">{formatINR(sampleProduct.mrp)}</span>
              </div>
              <button
                type="button"
                onClick={() => handleApplyTheme(true)}
                className="w-full py-2.5 px-4 text-xs font-bold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor:
                    draftTheme.buttonStyle === 'outline' ? 'transparent' : draftTheme.accentColor,
                  color: draftTheme.buttonStyle === 'outline' ? draftTheme.accentColor : '#18181B',
                  border:
                    draftTheme.buttonStyle === 'outline'
                      ? `1px solid ${draftTheme.accentColor}`
                      : 'none',
                  borderRadius:
                    draftTheme.borderRadius === 'none'
                      ? '0px'
                      : draftTheme.borderRadius === 'sm'
                      ? '6px'
                      : '10px',
                }}
              >
                Buy in Bulk (Preview CTA)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
