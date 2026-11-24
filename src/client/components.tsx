/** Shared visual primitives for the settings page. */
import { useState, type ReactNode } from 'react'

const BORDER = '1px solid var(--dsw-alias-border-secondary, #e5e7eb)'

export const S = {
  layout: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '2px 0', minWidth: 0 },
  nav: { display: 'flex', flexDirection: 'column' as const, gap: '4px', flex: '0 0 92px', width: '92px', position: 'sticky' as const, top: 0, alignSelf: 'flex-start', flexShrink: 0 },
  navItem: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '3px', padding: '7px 4px', borderRadius: '8px', border: '1px solid transparent', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '11px', lineHeight: 1.25, textAlign: 'center' as const },
  navItemActive: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '3px', padding: '7px 4px', borderRadius: '8px', border: BORDER, background: 'var(--dsw-alias-bg-secondary, rgba(127,127,127,0.08))', color: 'inherit', cursor: 'pointer', fontSize: '11px', lineHeight: 1.25, textAlign: 'center' as const, fontWeight: 600 },
  navIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 },
  content: { display: 'flex', flexDirection: 'column' as const, gap: '12px', flex: '1 1 auto', minWidth: 0, minHeight: 0, maxHeight: 'min(68vh, 600px)', overflowY: 'auto' as const, overscrollBehavior: 'contain' as const, paddingRight: '4px' },
  section: { border: BORDER, borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column' as const, gap: '2px' },
  header: { display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 10px' },
  heading: { margin: 0, fontSize: '15px', fontWeight: 600 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '6px 0' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '4px', padding: '6px 0' },
  label: { fontSize: '13px', opacity: 0.9 },
  hint: { fontSize: '12px', opacity: 0.55, marginTop: '2px', lineHeight: 1.45 },
  input: { width: '100%', boxSizing: 'border-box' as const, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border-secondary, #d4d4d8)', background: 'transparent', color: 'inherit', fontSize: '13px' },
  actions: { display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' as const, marginTop: '6px' },
  action: { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: '4px', minWidth: '96px' },
  note: { fontSize: '12px', opacity: 0.6, minHeight: '16px', maxWidth: '100%', overflowWrap: 'anywhere' as const, lineHeight: 1.45 },
  button: { padding: '6px 14px', borderRadius: '7px', border: '1px solid var(--dsw-alias-border-secondary, #d4d4d8)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '13px' },
  primary: { padding: '6px 16px', borderRadius: '7px', border: '1px solid transparent', background: 'var(--dsw-alias-bg-accent, #2563eb)', color: '#fff', cursor: 'pointer', fontSize: '13px' },
  state: { fontSize: '12px', padding: '1px 8px', borderRadius: '999px', border: '1px solid currentColor', opacity: 0.8 },
  switch: { position: 'relative' as const, display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' as const, width: '36px', height: '20px', borderRadius: '999px', background: 'var(--dsw-alias-bg-secondary, rgba(127,127,127,0.32))', border: '1px solid var(--dsw-alias-border-secondary, #d4d4d8)', transition: 'background 120ms ease', boxSizing: 'border-box' as const },
  switchOn: { background: 'var(--dsw-alias-bg-accent, #2563eb)', borderColor: 'transparent' },
  switchFocus: { outline: '2px solid var(--dsw-alias-bg-accent, #2563eb)', outlineOffset: '2px' },
  switchInput: { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer', appearance: 'none' as const },
  knob: { position: 'absolute' as const, left: '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'transform 120ms ease', pointerEvents: 'none' as const },
  knobOn: { transform: 'translateX(16px)' },
  qr: { width: '150px', height: '150px', border: BORDER, borderRadius: '8px', marginTop: '8px' },
  footer: { display: 'flex', alignItems: 'flex-start', gap: '14px', paddingTop: '4px' },
} as const

/** Text input bound to one config path. */
export function Field(props: { label: string; hint?: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label style={S.field}>
      <div style={S.label}>{props.label}</div>
      {props.hint === undefined ? null : <div style={S.hint}>{props.hint}</div>}
      <input style={S.input} value={props.value} placeholder={props.placeholder ?? ''} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  )
}

/** Switch bound to one boolean config path. */
export function Toggle(props: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  const [focused, setFocused] = useState(false)
  return (
    <label style={S.row}>
      <span>
        <div style={S.label}>{props.label}</div>
        {props.hint === undefined ? null : <div style={S.hint}>{props.hint}</div>}
      </span>
      <span style={{ ...S.switch, ...(props.checked ? S.switchOn : {}), ...(focused ? S.switchFocus : {}) }}>
        {/* The real checkbox stays for keyboard and screen readers; the track is paint only. */}
        <input
          type="checkbox"
          style={S.switchInput}
          checked={props.checked}
          onChange={(event) => props.onChange(event.target.checked)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <span style={{ ...S.knob, ...(props.checked ? S.knobOn : {}) }} />
      </span>
    </label>
  )
}

/** Comma separated list field. */
export function ListField(props: { label: string; hint?: string; value: readonly string[]; onChange: (value: string[]) => void }) {
  return (
    <Field
      label={props.label}
      {...(props.hint === undefined ? {} : { hint: props.hint })}
      value={props.value.join(', ')}
      onChange={(text) => props.onChange(text.split(',').map((part) => part.trim()).filter((part) => part.length > 0))}
    />
  )
}

/**
 * One card on the page: a title, the live state of that topic, and its body.
 * @param props - title, optional state label and the body.
 */
export function Section(props: { title: string; state?: string; children?: ReactNode }): JSX.Element {
  return (
    <section style={S.section}>
      <div style={S.header}>
        <h3 style={S.heading}>{props.title}</h3>
        {props.state === undefined ? null : <span style={S.state}>{props.state}</span>}
      </div>
      {props.children}
    </section>
  )
}
