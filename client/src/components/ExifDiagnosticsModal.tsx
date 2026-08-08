import React, { useState, useEffect } from 'react';
import { X, Search, AlertTriangle, CalendarX2 } from 'lucide-react';
import axios from 'axios';
import { ExifDiagnosticResult } from '../types';

interface ExifDiagnosticsModalProps {
  onClose: () => void;
}

export const ExifDiagnosticsModal: React.FC<ExifDiagnosticsModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ExifDiagnosticResult[]>([]);
  const [search, setSearch] = useState('');

  const [statusMessage, setStatusMessage] = useState('Initializing stream...');
  const [checkedCount, setCheckedCount] = useState(0);
  const [nextPage, setNextPage] = useState<number | null>(null);

  useEffect(() => {
    fetchDiagnosticsStream(1);
    return () => {
      // Clean up the stream if component unmounts
      // We will define eventSource in a ref or let it close naturally
    };
  }, []);

  const fetchDiagnosticsStream = (startPage: number = 1) => {
    if (startPage === 1) {
      setResults([]);
      setCheckedCount(0);
    }
    setLoading(true);
    setNextPage(null);
    
    // Default limit is 350 as requested by user
    const eventSource = new EventSource(`/api/exif/diagnostics/stream?startPage=${startPage}&limit=350`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          if (data.message) setStatusMessage(data.message);
          if (data.checked !== undefined) setCheckedCount(data.checked);
        } else if (data.type === 'mismatch') {
          setResults(prev => {
            // filter out duplicates just in case
            const newItems = data.items.filter((item: any) => !prev.some(p => p.assetId === item.assetId));
            return [...prev, ...newItems];
          });
        } else if (data.type === 'done') {
          setLoading(false);
          eventSource.close();
        } else if (data.type === 'stopped') {
          setLoading(false);
          setNextPage(data.next_page);
          eventSource.close();
        } else if (data.type === 'error') {
          console.error('EXIF stream error:', data.error);
          setStatusMessage(`Error: ${data.error}`);
          setLoading(false);
          eventSource.close();
        }
      } catch (e) {
        console.error('SSE parse error', e);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setStatusMessage('Connection lost or failed.');
      setLoading(false);
      eventSource.close();
    };
  };

  const filteredResults = results.filter(r => 
    r.originalFileName.toLowerCase().includes(search.toLowerCase()) || 
    r.albumNames.some(a => a.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        width: '95%',
        maxWidth: '1000px',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarX2 size={24} color="#facc15" />
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#facc15' }}>EXIF Date Diagnostics</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scanning your library for manually edited or missing dates</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
        
        {/* Toolbar */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', height: '36px', fontSize: '0.85rem' }}
              placeholder="Search filename or album..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Found <strong style={{ color: '#fff' }}>{results.length}</strong> issues in your library
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <div className="animate-spin" style={{ marginBottom: '16px' }}><Search size={32} /></div>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: '8px' }}>{statusMessage}</div>
              {checkedCount > 0 && <div>Checked {checkedCount} items... Found {results.length} issues so far.</div>}
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#34d399' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Perfect Library! 🎉</h3>
              <p>No date mismatches found. All files have original EXIF dates matching the database.</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No matches for your search.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px 8px', width: '60px' }}>Image</th>
                    <th style={{ padding: '12px 8px', minWidth: '200px' }}>Filename & Album</th>
                    <th style={{ padding: '12px 8px', width: '160px' }}>Immich DB Date</th>
                    <th style={{ padding: '12px 8px', width: '160px' }}>Raw EXIF Date</th>
                    <th style={{ padding: '12px 8px', width: '120px', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
              <tbody>
                {filteredResults.map(r => (
                  <tr key={r.assetId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <img 
                        src={`/api/immich/assets/${r.assetId}/thumbnail`} 
                        alt="" 
                        loading="lazy"
                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', background: '#334155' }}
                      />
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>{r.originalFileName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {r.albumNames.length > 0 ? r.albumNames.join(', ') : 'Not in any album'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.85rem', color: '#34d399' }}>
                      {new Date(r.dbDate).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.85rem', color: '#f87171' }}>
                      {r.exifDate ? new Date(r.exifDate).toLocaleString() : 'N/A (No Date)'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(250, 204, 21, 0.1)', border: '1px solid rgba(250, 204, 21, 0.3)', padding: '6px 10px', borderRadius: '6px', color: '#facc15', fontSize: '0.75rem', fontWeight: 600 }}>
                        <AlertTriangle size={14} />
                        {r.status === 'NO_EXIF' ? 'Missing EXIF' : `Mismatch (${r.diffMinutes}m)`}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          {!loading && nextPage && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <button
                className="btn-primary"
                onClick={() => fetchDiagnosticsStream(nextPage)}
              >
                Scan More (Limit Reached)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
