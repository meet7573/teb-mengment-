import React from 'react';
import { Palette, X, RotateCcw, Check, Sparkles } from 'lucide-react';
import { useTheme, presetThemes, ThemeConfig } from '../../context/ThemeContext';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, updateTheme, applyPreset, resetTheme } = useTheme();

  if (!isOpen) return null;

  const colorFields: { key: keyof ThemeConfig; label: string; desc: string }[] = [
    { key: 'primaryColor', label: 'Primary Color', desc: 'Main headers, active icons, primary badges' },
    { key: 'secondaryColor', label: 'Secondary Color', desc: 'Subheadings, highlights, secondary tabs' },
    { key: 'accentColor', label: 'Accent Color', desc: 'Focus rings, active selections, indicators' },
    { key: 'buttonColor', label: 'Button Color', desc: 'Primary action buttons, submit controls' },
    { key: 'successColor', label: 'Success Color', desc: 'Active badges, checkmarks, positive statuses' },
    { key: 'warningColor', label: 'Warning Color', desc: 'Coaching tags, pending alerts, cautions' },
    { key: 'errorColor', label: 'Error Color', desc: 'Inactive statuses, delete actions, errors' },
    { key: 'backgroundColor', label: 'Background Color', desc: 'Main page body canvas background' },
    { key: 'cardColor', label: 'Card Color', desc: 'Panels, tables, modals, container background' },
    { key: 'borderColor', label: 'Border Color', desc: 'Inputs, cards, dividers, subtle borders' },
    { key: 'fontColor', label: 'Font / Text Color', desc: 'Primary headings, dark body text, labels' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Centralized Theme Customization
              </h3>
              <p className="text-xs text-slate-500">
                Configure color palette live across the entire application without code changes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Preset Theme Selector */}
          <div>
            <label className="block font-bold text-slate-800 text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Quick Color Presets</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {presetThemes.map((p) => {
                const isActive = p.theme.primaryColor === theme.primaryColor && p.theme.backgroundColor === theme.backgroundColor;
                return (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p.theme)}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col gap-2 cursor-pointer ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">{p.name}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                    </div>
                    {/* Swatches preview */}
                    <div className="flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: p.theme.primaryColor }} title="Primary" />
                      <span className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: p.theme.buttonColor }} title="Button" />
                      <span className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: p.theme.backgroundColor }} title="Background" />
                      <span className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: p.theme.accentColor }} title="Accent" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Color Pickers Grid */}
          <div>
            <label className="block font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">
              Individual Color Variables (11 Configurable Keys)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {colorFields.map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white transition flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span>{label}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{desc}</div>
                    <div className="text-[10px] font-mono font-semibold text-slate-400 mt-1">
                      {theme[key]}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="color"
                      value={theme[key]}
                      onChange={(e) => updateTheme({ [key]: e.target.value })}
                      className="w-9 h-9 rounded-xl border border-slate-300 cursor-pointer p-0.5 bg-white shadow-2xs"
                    />
                    <input
                      type="text"
                      value={theme[key]}
                      onChange={(e) => updateTheme({ [key]: e.target.value })}
                      className="w-20 px-2 py-1 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={resetTheme}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-200/60 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Default Theme</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition cursor-pointer"
          >
            Apply & Close
          </button>
        </div>

      </div>
    </div>
  );
};
