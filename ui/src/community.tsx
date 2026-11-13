// 1.0: the community collection (community/ in the repository, published with the site): packs of recipes and of
// ratios to import in one click, and the open work shared as a pack proposed to the repository on GitHub.
import { useEffect, useState } from 'react';
import { Ico, Segmented } from './components';
import { t } from './i18n';
import type { CommunityEntry, CommunityIndex } from './packs';
import { canShare, importCommunity, loadCommunity, sharePack, useStore } from './store';

type Kind = 'recipes' | 'ratios';
type Look = { state: 'loading' } | { state: 'error' } | { state: 'ready'; index: CommunityIndex };

function PackCard({ e }: { e: CommunityEntry }) {
  const busy = useStore((s) => !!s.busy);
  const camera = e.family === 'gr4' ? 'GR IV' : e.family === 'gr3' ? 'GR III / IIIx' : '';
  return (
    <div className="card community-pack">
      <div className="soft-text">
        <b>{e.title}</b>
        <span className="muted small">{[e.author && t('communityBy', { a: e.author }), camera, t(e.kind === 'recipes' ? 'communityFilms' : 'communityRatios', { n: e.items.length })].filter(Boolean).join('  ·  ')}</span>
        {e.description && <span className="small community-desc">{e.description}</span>}
        <span className="chips community-items">{e.items.slice(0, 12).map((x, i) => <span key={i} className="chip">{x}</span>)}{e.items.length > 12 && <span className="chip">+{e.items.length - 12}</span>}</span>
      </div>
      <button className="btn primary small" disabled={busy} onClick={() => { void importCommunity(e); }}>{Ico.download}<span>{t('communityImport')}</span></button>
    </div>
  );
}

function ShareDialog({ kind, close }: { kind: Kind; close: () => void }) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [own, setOwn] = useState(false);
  const ready = title.trim().length > 0 && own;
  useEffect(() => {
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [close]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dialog community-share" role="dialog" aria-modal="true" aria-label={t(kind === 'recipes' ? 'communityShareRecipes' : 'communityShareRatios')}>
        <h3>{t(kind === 'recipes' ? 'communityShareRecipes' : 'communityShareRatios')}</h3>
        <label>{t('communityTitle')}<input className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} autoFocus /></label>
        <label>{t('communityAuthor')}<input className="input" value={author} maxLength={40} onChange={(e) => setAuthor(e.target.value)} /></label>
        <label>{t('communityDescription')}<textarea className="input" value={description} maxLength={300} rows={3} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="community-own"><input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} /><span>{t('communityOwn')}</span></label>
        <p className="muted small">{t('communityHow')}</p>
        <div className="dialog-actions">
          <button className="btn" onClick={close}>{t('cancel')}</button>
          <button className="btn primary" disabled={!ready} onClick={() => { close(); void sharePack(kind, { title: title.trim(), author: author.trim(), description: description.trim() }); }}>{Ico.external}<span>{t('communityShare')}</span></button>
        </div>
      </div>
    </div>
  );
}

export function CommunityPage() {
  const [kind, setKind] = useState<Kind>('recipes');
  const [look, setLook] = useState<Look>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState<Kind | null>(null);
  // re-read when the work changes, so that « Share » is offered only with something to share
  const shareable = useStore(() => canShare(kind));
  useEffect(() => {
    let live = true;
    setLook({ state: 'loading' });
    loadCommunity().then((index) => { if (live) setLook({ state: 'ready', index }); }, () => { if (live) setLook({ state: 'error' }); });
    return () => { live = false; };
  }, [attempt]);
  const packs = look.state === 'ready' ? look.index.packs.filter((p) => p.kind === kind) : [];
  return (
    <div className="page">
      <header className="page-head">
        <span className="page-icon">{Ico.users}</span>
        <h1>{t('navCommunity')}</h1>
        <Segmented<Kind> value={kind} onChange={setKind} options={[{ value: 'recipes', label: t('communityRecipes') }, { value: 'ratios', label: t('communityRatiosTab') }]} />
        <div className="head-right">
          <button className="btn" disabled={!shareable} title={shareable ? undefined : t('packNothing')} onClick={() => setSharing(kind)}>{Ico.external}<span>{t(kind === 'recipes' ? 'communityShareRecipes' : 'communityShareRatios')}</span></button>
        </div>
      </header>
      <p className="muted small community-intro">{t('communityIntro')}</p>
      <div className="community-list" data-tour-page="community">
        {look.state === 'loading' && <div className="fw-rel idle"><span className="spinner small" /><span className="muted">{t('communityLoading')}</span></div>}
        {look.state === 'error' && <div className="fw-rel idle"><span className="muted">{t('communityNetError')}</span><span className="grow" /><button className="btn small" onClick={() => setAttempt((n) => n + 1)}>{t('retry')}</button></div>}
        {look.state === 'ready' && packs.length === 0 && <p className="muted">{t('communityEmpty')}</p>}
        {packs.map((e) => <PackCard key={e.file} e={e} />)}
      </div>
      {sharing && <ShareDialog kind={sharing} close={() => setSharing(null)} />}
    </div>
  );
}
