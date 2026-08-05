import React, { useState, useEffect } from 'react';
import { FolderHeart, CheckSquare, Square, Search, Layers, RefreshCw, Image, Sparkles, Filter, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { ImmichAlbum, ImmichAsset, MigrationMode } from '../types';

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
              filteredAssets.map((asset) => {
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {isSelected ? (
                        <CheckSquare size={18} color="#06b6d4" />
                      ) : (
                        <Square size={18} color="var(--text-muted)" />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>
                          {asset.originalFileName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(asset.fileCreatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                      {asset.type}
                    </span>
                  </div>
                );
              })
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
                        <CheckSquare size={18} color="#06b6d4" />
                      ) : (
                        <Square size={18} color="var(--text-muted)" />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{album.albumName}</div>
                        {album.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{album.description}</div>
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
    </div>
  );
};
