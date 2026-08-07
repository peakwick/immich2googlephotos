import React, { useState, useEffect } from 'react';
import { FolderHeart, CheckSquare, Square, Search, Layers, RefreshCw, Image, Sparkles, Filter, ArrowRight, History, Trash2, X } from 'lucide-react';
import axios from 'axios';
import { ImmichAlbum, ImmichAsset, MigrationMode, MigrationSession } from '../types';

interface AlbumSelectionCardProps {
  albums: ImmichAlbum[];
  assets: ImmichAsset[];
  libraryCount: number;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectionChange: (
    mode: MigrationMode,
    selectedAlbumIds: string[],
    createAlbums: boolean,
    selectedAssetIds?: string[],
    maxItemsLimit?: number,
    maxConcurrency?: number
  ) => void;
  disabled: boolean;
  onNextStep?: () => void;
}

export const AlbumSelectionCard: React.FC<AlbumSelectionCardProps> = ({
  albums,
  assets,
  libraryCount,
  loading,
  error,
  onRefresh,
  onSelectionChange,
  disabled,
  onNextStep,
}) => {

  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<MigrationMode>('TEST_BATCH'); // Default to safe Test Batch!
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [testLimit, setTestLimit] = useState<number>(5);
  const [createAlbums, setCreateAlbums] = useState(true);
  const [maxConcurrency, setMaxConcurrency] = useState<number>(5);
  const [visibleAssetCount, setVisibleAssetCount] = useState(100);

  // History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [sessions, setSessions] = useState<MigrationSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await axios.get('/api/history/sessions');
      if (res.data.success) {
        setSessions(res.data.sessions);
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
    setLoadingHistory(false);
  };

  const handleOpenHistory = () => {
    fetchHistory();
    setShowHistoryModal(true);
  };

  const handleResetSession = async (id: string) => {
    if (!confirm('Are you sure you want to forget this session? (Google Photos will NOT delete the photos, but this app will forget they were migrated)')) return;
    try {
      await axios.delete(`/api/history/sessions/${id}`);
      fetchHistory();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetAllHistory = async () => {
    if (!confirm('Are you sure you want to reset the ENTIRE migration history?')) return;
    try {
      await axios.delete('/api/history');
      fetchHistory();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setVisibleAssetCount(100);
  }, [search]);

  useEffect(() => {
    // Notify parent of safe initial state on mount
    onSelectionChange('TEST_BATCH', [], createAlbums, [], 5, 5);
  }, []);

  const notifyChange = (
    newMode: MigrationMode,
    albumIds: string[],
    assetIds: string[],
    limit?: number,
    createAlb?: boolean,
    concurrency?: number
  ) => {
    const effectiveLimit = newMode === 'TEST_BATCH' ? (limit ?? testLimit) : undefined;
    onSelectionChange(
      newMode,
      albumIds,
      createAlb ?? createAlbums,
      assetIds,
      effectiveLimit,
      concurrency ?? maxConcurrency
    );
  };

  const handleModeChange = (newMode: MigrationMode) => {
    setMode(newMode);
    notifyChange(newMode, selectedAlbumIds, selectedAssetIds, testLimit);
  };

  const handleToggleAlbum = (id: string) => {
    const updated = selectedAlbumIds.includes(id)
      ? selectedAlbumIds.filter((item) => item !== id)
      : [...selectedAlbumIds, id];
    setSelectedAlbumIds(updated);
    notifyChange(mode, updated, selectedAssetIds);
  };

  const handleToggleAsset = (id: string) => {
    const updated = selectedAssetIds.includes(id)
      ? selectedAssetIds.filter((item) => item !== id)
      : [...selectedAssetIds, id];
    setSelectedAssetIds(updated);
    notifyChange(mode, selectedAlbumIds, updated);
  };

  const handleSelectAllAlbums = () => {
    const allIds = albums.map((a) => a.id);
    setSelectedAlbumIds(allIds);
    notifyChange(mode, allIds, selectedAssetIds);
  };

  const handleDeselectAllAlbums = () => {
    setSelectedAlbumIds([]);
    notifyChange(mode, [], selectedAssetIds);
  };

  const handleSelectAllAssets = () => {
    const allIds = assets.map((a) => a.id);
    setSelectedAssetIds(allIds);
    notifyChange(mode, selectedAlbumIds, allIds);
  };

  const handleDeselectAllAssets = () => {
    setSelectedAssetIds([]);
    notifyChange(mode, selectedAlbumIds, []);
  };

  const filteredAlbums = albums.filter((a) =>
    a.albumName.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAssets = assets.filter((a) =>
    a.originalFileName.toLowerCase().includes(search.toLowerCase())
  );
  
  const displayedAssets = filteredAssets.slice(0, visibleAssetCount);

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981',
          }}>
            <FolderHeart size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem' }}>3. Select Migration Mode & Content</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Choose a quick test batch, specific albums, individual photos, or your entire library
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleOpenHistory}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={loading || disabled}
            title="Migration History"
          >
            <History size={16} />
            <span style={{ fontSize: '0.85rem' }}>History</span>
          </button>
          <button
            onClick={onRefresh}
            className="btn btn-secondary"
            style={{ padding: '8px 12px' }}
            disabled={loading || disabled}
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px',
        marginBottom: '20px',
      }}>
        {/* Test Batch Tab */}
        <button
          type="button"
          onClick={() => handleModeChange('TEST_BATCH')}
          style={{
            padding: '12px',
            borderRadius: '10px',
            border: mode === 'TEST_BATCH' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
            background: mode === 'TEST_BATCH' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
            color: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: mode === 'TEST_BATCH' ? '#34d399' : '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} /> Quick Test (RECOMMENDED)
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Migrate first {testLimit} items only
          </div>
        </button>

        {/* Individual Photos Tab */}
        <button
          type="button"
          onClick={() => handleModeChange('SELECTED_ASSETS')}
          style={{
            padding: '12px',
            borderRadius: '10px',
            border: mode === 'SELECTED_ASSETS' ? '2px solid #06b6d4' : '1px solid var(--border-subtle)',
            background: mode === 'SELECTED_ASSETS' ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-input)',
            color: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px' }}>Asset Picker</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Selected {selectedAssetIds.length} items
          </div>
        </button>

        {/* Selected Albums Tab */}
        <button
          type="button"
          onClick={() => handleModeChange('SELECTED_ALBUMS')}
          style={{
            padding: '12px',
            borderRadius: '10px',
            border: mode === 'SELECTED_ALBUMS' ? '2px solid #06b6d4' : '1px solid var(--border-subtle)',
            background: mode === 'SELECTED_ALBUMS' ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-input)',
            color: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px' }}>Album Picker</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Selected {selectedAlbumIds.length} albums
          </div>
        </button>

        {/* All Photos Tab */}
        <button
          type="button"
          onClick={() => handleModeChange('ALL_PHOTOS')}
          style={{
            padding: '12px',
            borderRadius: '10px',
            border: mode === 'ALL_PHOTOS' ? '2px solid #06b6d4' : '1px solid var(--border-subtle)',
            background: mode === 'ALL_PHOTOS' ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-input)',
            color: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px' }}>Full Library</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Total {libraryCount} items
          </div>
        </button>
      </div>

      {/* Concurrency & Performance Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        padding: '14px 16px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '20px',
      }}>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px', color: '#38bdf8' }}>
            ⚡️ Parallel Upload Speed (Worker Threads)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              value={maxConcurrency}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxConcurrency(val);
                notifyChange(mode, selectedAlbumIds, selectedAssetIds, testLimit, createAlbums, val);
              }}
              className="form-input"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              disabled={disabled}
            >
              <option value={1}>1 Thread (Sequential / Slow)</option>
              <option value={3}>3 Threads (Balanced)</option>
              <option value={5}>5 Threads (Fast - Default ⭐)</option>
              <option value={8}>8 Threads (Very Fast 🚀)</option>
              <option value={10}>10 Threads (Maximum Performance 🔥)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            id="createAlbumsCheck"
            checked={createAlbums}
            onChange={(e) => {
              const val = e.target.checked;
              setCreateAlbums(val);
              notifyChange(mode, selectedAlbumIds, selectedAssetIds, testLimit, val, maxConcurrency);
            }}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            disabled={disabled}
          />
          <label htmlFor="createAlbumsCheck" style={{ fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
            <strong>Replicate Immich Albums to Google Photos</strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Automatically maps and creates matching Google Photos Albums
            </div>
          </label>
        </div>
      </div>

      {/* Mode 1: Quick Test Batch */}
      {mode === 'TEST_BATCH' && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
        }}>
          <h4 style={{ fontSize: '1rem', color: '#34d399', marginBottom: '8px' }}>
            Quick Test Batch (Safe Mode)
          </h4>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Migrates only a small number of assets from your library to verify credentials and upload speed safely.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>How many items to test?</label>
            <select
              className="form-input"
              style={{ width: '120px' }}
              value={testLimit}
              onChange={(e) => {
                const val = Number(e.target.value);
                setTestLimit(val);
                notifyChange(mode, selectedAlbumIds, selectedAssetIds, val);
              }}
            >
              <option value="1">1 Item</option>
              <option value="3">3 Items</option>
              <option value="5">5 Items</option>
              <option value="10">10 Items</option>
              <option value="25">25 Items</option>
              <option value="50">50 Items</option>
            </select>
          </div>
        </div>
      )}

      {/* Mode 2: Individual Photo / Video Picker */}
      {mode === 'SELECTED_ASSETS' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSelectAllAssets}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <CheckSquare size={14} /> Select All
              </button>
              <button
                type="button"
                onClick={handleDeselectAllAssets}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <Square size={14} /> Deselect All
              </button>
            </div>

            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '34px', paddingRight: '12px', height: '36px', fontSize: '0.85rem' }}
                placeholder="Search assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{
            maxHeight: '280px',
            overflowY: 'auto',
            background: 'var(--bg-input)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            padding: '8px',
          }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading photos...
              </div>
            ) : filteredAssets.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No photos found.
              </div>
            ) : (
              <>
                {displayedAssets.map((asset) => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleToggleAsset(asset.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                        marginBottom: '4px',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                        {isSelected ? (
                          <CheckSquare size={18} color="#06b6d4" style={{ flexShrink: 0 }} />
                        ) : (
                          <Square size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        )}
                        <img 
                          src={`/api/immich/assets/${asset.id}/thumbnail`} 
                          alt="" 
                          loading="lazy"
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', background: '#334155', flexShrink: 0 }}
                        />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {asset.originalFileName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(asset.fileCreatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <span className="badge badge-info" style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                        {asset.type}
                      </span>
                    </div>
                  );
                })}
                {visibleAssetCount < filteredAssets.length && (
                  <div style={{ textAlign: 'center', marginTop: '12px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setVisibleAssetCount(prev => prev + 100)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      Load More ({filteredAssets.length - visibleAssetCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mode 3: Selected Albums */}
      {mode === 'SELECTED_ALBUMS' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSelectAllAlbums}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <CheckSquare size={14} /> Select All
              </button>
              <button
                type="button"
                onClick={handleDeselectAllAlbums}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <Square size={14} /> Deselect All
              </button>
            </div>

            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '34px', paddingRight: '12px', height: '36px', fontSize: '0.85rem' }}
                placeholder="Search albums..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{
            maxHeight: '240px',
            overflowY: 'auto',
            background: 'var(--bg-input)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            padding: '8px',
          }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading albums...
              </div>
            ) : filteredAlbums.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No albums found.
              </div>
            ) : (
              filteredAlbums.map((album) => {
                const isSelected = selectedAlbumIds.includes(album.id);
                return (
                  <div
                    key={album.id}
                    onClick={() => handleToggleAlbum(album.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                      marginBottom: '4px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {isSelected ? (
                        <CheckSquare size={18} color="#06b6d4" style={{ flexShrink: 0 }} />
                      ) : (
                        <Square size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      )}
                      
                      {album.albumThumbnailAssetId ? (
                        <img 
                          src={`/api/immich/assets/${album.albumThumbnailAssetId}/thumbnail`} 
                          alt="" 
                          loading="lazy"
                          style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', background: '#334155', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: '44px', height: '44px', borderRadius: '6px', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Layers size={20} color="var(--text-muted)" />
                        </div>
                      )}

                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {album.albumName}
                        </div>
                        {album.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {album.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                      <Layers size={12} />
                      <span>{album.assetCount} içerik</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '10px' }}>
          {error}
        </div>
      )}

      {onNextStep && (
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onNextStep}
            className="btn btn-primary"
            style={{ padding: '14px 28px' }}
          >
            <span>Proceed to Migration Engine (Step 4)</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={20} color="#38bdf8" />
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Migration Sessions History</h2>
              </div>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading history...</div>
              ) : sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No migration sessions found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {sessions.map(session => (
                    <div key={session.id} style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                          {session.description || `Migration (${session.mode})`}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '16px' }}>
                          <span>Date: {new Date(session.date).toLocaleString()}</span>
                          <span>Assets: {session.totalAssetsMigrated}</span>
                          {session.albumsCreated > 0 && <span>Albums Created: {session.albumsCreated}</span>}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleResetSession(session.id)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}
                        title="Forget this session (allows re-migrating these items)"
                      >
                        <Trash2 size={14} style={{ marginRight: '6px' }} />
                        Reset Session
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
              <button 
                onClick={handleResetAllHistory}
                className="btn btn-secondary" 
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                disabled={sessions.length === 0}
              >
                Clear Entire Database
              </button>
              <button onClick={() => setShowHistoryModal(false)} className="btn btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
